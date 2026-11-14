import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma } from "@/lib/auth/session";
import { encryptPixKey, isPlausiblePixKey, maskPixKey } from "@/lib/wallet/pix-key-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const schema = zodSchema();

function zodSchema() {
  return { safeParse(value: unknown): { success: true; data: { pixKey: string } } | { success: false } {
    if (!value || typeof value !== "object" || !("pixKey" in value) || typeof value.pixKey !== "string") return { success: false };
    const pixKey = value.pixKey.trim();
    return pixKey.length >= 3 && pixKey.length <= 200 && isPlausiblePixKey(pixKey) ? { success: true, data: { pixKey } } : { success: false };
  } };
}

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try { const parsed = new URL(origin); return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.host.toLowerCase() === host; }
  catch { return false; }
}

export async function POST(request: NextRequest, context: { params: Promise<{ receiptCode: string }> }) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const { receiptCode: raw } = await context.params;
  const receiptCode = raw.replace(/\\s/g, "").toUpperCase();
  if (!/^SQ-[A-Z0-9]{8,32}$/.test(receiptCode)) return NextResponse.json({ error: "Código de recibo inválido." }, { status: 400, headers });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Informe uma chave Pix válida." }, { status: 400, headers });
  let encrypted: string;
  try { encrypted = encryptPixKey(parsed.data.pixKey); }
  catch { return NextResponse.json({ error: "Não foi possível proteger a chave Pix. A solicitação não foi enviada." }, { status: 503, headers }); }

  try {
    const result = await authPrisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { receiptCode },
        select: { id: true, status: true, paymentMethod: true, confirmedAt: true, cashierId: true, playerId: true,
          payment: { select: { status: true, confirmedAt: true } },
          participations: { where: { status: "CONFIRMED" }, select: { round: { select: { status: true } }, numericLines: {
            select: { id: true, prizeCents: true, prizeCreditedAt: true, prizePayout: { select: { id: true } }, prizePaymentRequest: { select: { id: true, status: true } } },
          } } },
        },
      });
      if (!purchase || !purchase.cashierId || purchase.playerId !== null) throw new Error("PHYSICAL_RECEIPT_ONLY");
      const confirmed = purchase.status === "CONFIRMED" && purchase.confirmedAt !== null &&
        (purchase.paymentMethod === "CASH" || purchase.paymentMethod === "WALLET" ||
          (purchase.payment?.status === "CONFIRMED" && purchase.payment.confirmedAt !== null));
      if (!confirmed) throw new Error("PAYMENT_NOT_CONFIRMED");
      const eligible = purchase.participations.flatMap((part) => part.round.status === "COMPLETED"
        ? part.numericLines.filter((line) => (line.prizeCents ?? 0) > 0 && !line.prizeCreditedAt && !line.prizePayout)
        : []);
      if (!eligible.length) throw new Error("NO_UNPAID_PRIZE");
      const blocked = eligible.filter((line) => line.prizePaymentRequest?.status === "PENDING" || line.prizePaymentRequest?.status === "PAID");
      if (blocked.length) throw new Error("REQUEST_ALREADY_EXISTS");
      let created = 0;
      let grossTotalCents = 0, administrativeTotalCents = 0, transactionTotalCents = 0, netTotalCents = 0;
      for (const line of eligible) {
        const gross = line.prizeCents ?? 0;
        const appliesFees = gross >= 100000;
        const administrativeFee = appliesFees ? Math.round(gross * 0.05) : 0;
        const transactionFee = appliesFees ? Math.round(gross * 0.05) : 0;
        const net = gross - administrativeFee - transactionFee;
        const existing = line.prizePaymentRequest;
        const data = {
          purchaseId: purchase.id, pixKeyEncrypted: encrypted, pixKeyMasked: maskPixKey(parsed.data.pixKey),
          grossCents: gross, administrativeFeeCents: administrativeFee, transactionFeeCents: transactionFee,
          netCents: net, feeRuleVersion: "physical-prize-fees-v1", status: "PENDING" as const,
          requestedAt: new Date(), reviewedAt: null, reviewerId: null, paymentReference: null, note: null,
        };
        if (existing?.status === "REJECTED") {
          await tx.prizePaymentRequest.update({ where: { id: existing.id }, data });
        } else {
          await tx.prizePaymentRequest.create({ data: { ...data, id: "ppr_" + randomUUID().replace(/-/g, ""), participationLineId: line.id } });
        }
        created++;
        grossTotalCents += gross; administrativeTotalCents += administrativeFee;
        transactionTotalCents += transactionFee; netTotalCents += net;
      }
      await tx.auditEvent.create({ data: {
        action: "PRIZE_PIX_REQUESTED", entityType: "Purchase", entityId: purchase.id,
        metadata: { receiptCode, requestCount: created, pixKeyMasked: maskPixKey(parsed.data.pixKey), grossTotalCents, administrativeTotalCents, transactionTotalCents, netTotalCents },
      } });
      return { requestCount: created, grossTotalCents, administrativeTotalCents, transactionTotalCents, netTotalCents };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true, request: result, message: "Solicitação enviada à plataforma. Aguarde a análise do administrador." }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "O recibo foi atualizado simultaneamente. Atualize a consulta e tente novamente." }, { status: 409, headers });
    const code = error instanceof Error ? error.message : "";
    if (code === "PHYSICAL_RECEIPT_ONLY") return NextResponse.json({ error: "Solicitações Pix por recibo estão disponíveis somente para vendas físicas." }, { status: 403, headers });
    if (code === "PAYMENT_NOT_CONFIRMED") return NextResponse.json({ error: "O pagamento deste recibo ainda não está confirmado." }, { status: 409, headers });
    if (code === "NO_UNPAID_PRIZE") return NextResponse.json({ error: "Não há prêmio disponível para solicitar neste recibo." }, { status: 409, headers });
    if (code === "REQUEST_ALREADY_EXISTS") return NextResponse.json({ error: "Já existe uma solicitação em análise ou um pagamento registrado para um ou mais prêmios deste recibo." }, { status: 409, headers });
    return NextResponse.json({ error: "Não foi possível enviar a solicitação Pix." }, { status: 500, headers });
  }
}
