import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { decryptPixKey } from "@/lib/wallet/pix-key-crypto";
import { createAsaasPixTransfer } from "@/modules/payments/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.host.toLowerCase() === host;
  } catch { return false; }
}

export async function POST(request: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "ADMIN" || user.mustChangePassword) return NextResponse.json({ error: "Somente o administrador pode autorizar o Pix." }, { status: 403, headers });

  const { requestId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404, headers });

  let requestRow;
  try {
    requestRow = await authPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PrizePaymentRequest" WHERE "id" = ${requestId} FOR UPDATE`;
      const item = await tx.prizePaymentRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true, status: true, pixKeyEncrypted: true, pixKeyType: true,
          netCents: true, asaasTransferId: true, paymentReference: true,
          participationLine: { select: { prizeCents: true, prizeCreditedAt: true, prizePayout: { select: { id: true } } } },
        },
      });
      if (!item) throw new Error("NOT_FOUND");
      if (item.status === "PROCESSING" || item.asaasTransferId) throw new Error("ALREADY_PROCESSING");
      if (!["PENDING", "FAILED", "CANCELLED"].includes(item.status)) throw new Error("NOT_PAYABLE");
      if (!item.pixKeyEncrypted || !item.pixKeyType) throw new Error("BENEFICIARY_DATA_MISSING");
      if (item.participationLine.prizeCreditedAt || item.participationLine.prizePayout || (item.participationLine.prizeCents ?? 0) <= 0) throw new Error("PRIZE_ALREADY_PAID");
      const changed = await tx.prizePaymentRequest.updateMany({
        where: { id: item.id, status: item.status, asaasTransferId: null },
        data: {
          status: "PROCESSING", asaasTransferStatus: "CREATING",
          asaasTransferFailureReason: null, asaasTransferReceiptUrl: null,
          transferRequestedAt: new Date(), reviewedAt: new Date(), reviewerId: user.id,
          paymentReference: "prize_request_" + item.id,
        },
      });
      if (changed.count !== 1) throw new Error("ALREADY_PROCESSING");
      await tx.auditEvent.create({ data: {
        actorId: user.id, action: "PRIZE_ASAAS_TRANSFER_REQUESTED",
        entityType: "PrizePaymentRequest", entityId: item.id,
        metadata: { netCents: item.netCents, pixKeyType: item.pixKeyType, externalReference: "prize_request_" + item.id },
      } });
      return { id: item.id, netCents: item.netCents, pixKeyEncrypted: item.pixKeyEncrypted, pixKeyType: item.pixKeyType };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404, headers });
    if (code === "ALREADY_PROCESSING") return NextResponse.json({ error: "Esta transferência já foi iniciada. Aguarde a conciliação; não envie outro Pix." }, { status: 409, headers });
    if (code === "NOT_PAYABLE" || code === "PRIZE_ALREADY_PAID") return NextResponse.json({ error: "Esta solicitação não está disponível para pagamento." }, { status: 409, headers });
    if (code === "BENEFICIARY_DATA_MISSING") return NextResponse.json({ error: "Dados protegidos do beneficiário indisponíveis. Solicite nova chave Pix." }, { status: 409, headers });
    return NextResponse.json({ error: "Não foi possível reservar a solicitação para pagamento." }, { status: 500, headers });
  }

  try {
    const pixKey = decryptPixKey(requestRow.pixKeyEncrypted);
    const transfer = await createAsaasPixTransfer({
      amountCents: requestRow.netCents,
      pixKey,
      pixKeyType: requestRow.pixKeyType as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP",
      externalReference: "prize_request_" + requestRow.id,
    });
    await authPrisma.prizePaymentRequest.updateMany({
      where: { id: requestRow.id, status: "PROCESSING", asaasTransferId: null },
      data: { asaasTransferId: transfer.id, asaasTransferStatus: transfer.status ?? "PENDING" },
    });
    return NextResponse.json({
      success: true, status: "PROCESSING",
      message: "Transferência enviada à Asaas. O prêmio só será marcado como pago após a confirmação do webhook.",
    }, { status: 202, headers });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
    // A definitive validation/authentication rejection means no transfer was created.
    // A timeout or server-side error is ambiguous, so keep PROCESSING to prevent a duplicate Pix.
    if (status >= 400 && status < 500) {
      await authPrisma.prizePaymentRequest.updateMany({
        where: { id: requestRow.id, status: "PROCESSING", asaasTransferId: null },
        data: { status: "PENDING", asaasTransferStatus: "REJECTED", asaasTransferFailureReason: "A Asaas rejeitou a solicitação. Verifique a configuração e os dados antes de tentar novamente." },
      }).catch(() => undefined);
      return NextResponse.json({ error: "A Asaas recusou a transferência. Nenhum pagamento foi confirmado; revise a chave e a configuração." }, { status: 502, headers });
    }
    return NextResponse.json({
      error: "Resultado inconclusivo na Asaas. A solicitação ficou bloqueada contra duplicidade; confira o painel e os webhooks antes de qualquer nova tentativa.",
      status: "PROCESSING",
    }, { status: 202, headers });
  }
}
