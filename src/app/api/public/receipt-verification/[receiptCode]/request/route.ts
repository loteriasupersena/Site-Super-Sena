import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma } from "@/lib/auth/session";
import { encryptPixKey, isPlausiblePixKey, maskPixKey } from "@/lib/wallet/pix-key-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

// Taxas aplicáveis somente a prêmios de vendas físicas: a partir de R$ 1.000,00.
const PRIZE_FEE_THRESHOLD_CENTS = 100_000;
const ADMINISTRATIVE_FEE_RATE = 0.05;
const BANK_TRANSACTION_FEE_RATE = 0.05;

function validCpf(value: string) {\n  const cpf = value.replace(/\\D/g, "");\n  if (!/^\\d{11}$/.test(cpf) || /^(\\d)\\1{10}$/.test(cpf)) return false;\n  const digit = (length: number) => { const sum = cpf.slice(0, length).split("").reduce((total, n, i) => total + Number(n) * (length + 1 - i), 0); const result = (sum * 10) % 11; return result === 10 ? 0 : result; };\n  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);\n}\n\nfunction parsePayload(value: unknown): { participationLineId: string; pixKey: string; pixKeyType: string; holderName: string; holderCpf: string } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.participationLineId !== "string" || body.participationLineId.length < 1 ||
      body.participationLineId.length > 128 || typeof body.pixKey !== "string" ||
      typeof body.pixKeyConfirmation !== "string" || body.pixKeyConfirmed !== true) return null;
  const pixKey = body.pixKey.trim();
  if (pixKey.length < 3 || pixKey.length > 200 || pixKey !== body.pixKeyConfirmation.trim() || !isPlausiblePixKey(pixKey)) return null;
  return { participationLineId: body.participationLineId, pixKey };
}

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.host.toLowerCase() === host;
  } catch { return false; }
}

export async function POST(request: NextRequest, context: { params: Promise<{ receiptCode: string }> }) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const { receiptCode: raw } = await context.params;
  const receiptCode = raw.replace(/\s/g, "").toUpperCase();
  if (!/^SQ-[A-Z0-9]{8,32}$/.test(receiptCode)) return NextResponse.json({ error: "Código de recibo inválido." }, { status: 400, headers });

  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  const parsed = parsePayload(payload);
  if (!parsed) return NextResponse.json({ error: "Informe nome completo, CPF válido, tipo e chave Pix, e confirme os dados do titular." }, { status: 400, headers });

  let encrypted: string;
  try { encrypted = encryptPixKey(parsed.pixKey); }
  catch { return NextResponse.json({ error: "Não foi possível proteger a chave Pix. A solicitação não foi enviada." }, { status: 503, headers }); }

  try {
    const result = await authPrisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { receiptCode },
        select: {
          id: true, status: true, paymentMethod: true, confirmedAt: true, cashierId: true, playerId: true,
          payment: { select: { status: true, confirmedAt: true } },
        },
      });
      if (!purchase || !purchase.cashierId || purchase.playerId !== null) throw new Error("PHYSICAL_RECEIPT_ONLY");
      const confirmed = purchase.status === "CONFIRMED" && purchase.confirmedAt !== null &&
        (purchase.paymentMethod === "CASH" || purchase.paymentMethod === "WALLET" ||
          (purchase.payment?.status === "CONFIRMED" && purchase.payment.confirmedAt !== null));
      if (!confirmed) throw new Error("PAYMENT_NOT_CONFIRMED");

      const line = await tx.numericParticipationLine.findFirst({
        where: {
          id: parsed.participationLineId,
          participation: { purchaseId: purchase.id, status: "CONFIRMED", round: { status: "COMPLETED", resultNumber: { not: null } } },
        },
        select: {
          id: true, prizeCents: true, prizeCreditedAt: true,
          prizePayout: { select: { id: true } },
          prizePaymentRequest: { select: { id: true, status: true } },
        },
      });
      if (!line) throw new Error("PRIZE_NOT_FOUND");
      const gross = line.prizeCents ?? 0;
      if (gross <= 0 || line.prizeCreditedAt || line.prizePayout) throw new Error("PRIZE_NOT_AVAILABLE");
      if (line.prizePaymentRequest && line.prizePaymentRequest.status !== "REJECTED") throw new Error("REQUEST_ALREADY_EXISTS");

      const appliesFees = gross >= PRIZE_FEE_THRESHOLD_CENTS;
      const administrativeFee = appliesFees ? Math.round(gross * ADMINISTRATIVE_FEE_RATE) : 0;
      const transactionFee = appliesFees ? Math.round(gross * BANK_TRANSACTION_FEE_RATE) : 0;
      const net = gross - administrativeFee - transactionFee;
      const data = {
        purchaseId: purchase.id,
        pixKeyEncrypted: encrypted,
        pixKeyMasked: maskPixKey(parsed.pixKey),\n        pixKeyType: parsed.pixKeyType,\n        holderNameEncrypted: encryptedName,\n        holderCpfEncrypted: encryptedCpf,\n        holderCpfMasked: "***.***.***-" + parsed.holderCpf.slice(-2),
        grossCents: gross,
        administrativeFeeCents: administrativeFee,
        transactionFeeCents: transactionFee,
        netCents: net,
        feeRuleVersion: "physical-prize-fees-v1",
        status: "PENDING" as const,
        requestedAt: new Date(),
        reviewedAt: null,
        reviewerId: null,
        paymentReference: null,
        note: null,
      };
      if (line.prizePaymentRequest?.status === "REJECTED") {
        await tx.prizePaymentRequest.update({ where: { id: line.prizePaymentRequest.id }, data });
      } else {
        await tx.prizePaymentRequest.create({
          data: { ...data, id: "ppr_" + randomUUID().replace(/-/g, ""), participationLineId: line.id },
        });
      }
      await tx.auditEvent.create({ data: {
        action: "PRIZE_PIX_REQUESTED",
        entityType: "PrizePaymentRequest",
        entityId: line.prizePaymentRequest?.id ?? line.id,
        metadata: {
          receiptCode, participationLineId: line.id,
          pixKeyMasked: maskPixKey(parsed.pixKey),\n          pixKeyType: parsed.pixKeyType, holderCpfMasked: "***.***.***-" + parsed.holderCpf.slice(-2),
          grossCents: gross, administrativeFeeCents: administrativeFee,
          transactionFeeCents: transactionFee, netCents: net,
        },
      } });
      return { participationLineId: line.id, grossCents: gross, administrativeFeeCents: administrativeFee, transactionFeeCents: transactionFee, netCents: net };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true, request: result, message: "Solicitação deste prêmio enviada. Aguarde a análise do administrador." }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002")) {
      return NextResponse.json({ error: "Este prêmio foi atualizado simultaneamente ou já possui uma solicitação. Atualize o recibo e tente novamente." }, { status: 409, headers });
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "PHYSICAL_RECEIPT_ONLY") return NextResponse.json({ error: "Solicitações Pix por recibo estão disponíveis somente para vendas físicas." }, { status: 403, headers });
    if (code === "PAYMENT_NOT_CONFIRMED") return NextResponse.json({ error: "O pagamento deste recibo ainda não está confirmado." }, { status: 409, headers });
    if (code === "PRIZE_NOT_FOUND") return NextResponse.json({ error: "O prêmio informado não pertence a este recibo." }, { status: 404, headers });
    if (code === "PRIZE_NOT_AVAILABLE") return NextResponse.json({ error: "Este prêmio não está disponível para solicitação." }, { status: 409, headers });
    if (code === "REQUEST_ALREADY_EXISTS") return NextResponse.json({ error: "Este prêmio já possui uma solicitação em análise ou um pagamento registrado." }, { status: 409, headers });
    return NextResponse.json({ error: "Não foi possível enviar a solicitação Pix." }, { status: 500, headers });
  }
}
