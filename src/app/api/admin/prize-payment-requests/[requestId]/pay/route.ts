import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
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

  let transferData;
  try {
    transferData = await authPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PrizePaymentRequest" WHERE "id" = ${requestId} FOR UPDATE`;
      const item = await tx.prizePaymentRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true, status: true, batchId: true, pixKey: true, pixKeyType: true,
          netCents: true, asaasTransferId: true,
          participationLine: { select: { prizeCents: true, prizeCreditedAt: true, prizePayout: { select: { id: true } } } },
        },
      });
      if (!item) throw new Error("NOT_FOUND");

      if (item.batchId) {
        await tx.$queryRaw`SELECT "id" FROM "PrizePaymentBatch" WHERE "id" = ${item.batchId} FOR UPDATE`;
        const batch = await tx.prizePaymentBatch.findUnique({
          where: { id: item.batchId },
          select: {
            id: true, status: true, pixKey: true, pixKeyType: true, netCents: true,
            asaasTransferId: true, paymentReference: true,
            requests: { select: { id: true, status: true, participationLine: { select: { prizeCents: true, prizeCreditedAt: true, prizePayout: { select: { id: true } } } } } },
          },
        });
        if (!batch) throw new Error("BATCH_NOT_FOUND");
        if (batch.status === "PROCESSING" || batch.asaasTransferId) throw new Error("ALREADY_PROCESSING");
        if (![ "PENDING", "FAILED", "CANCELLED" ].includes(batch.status)) throw new Error("NOT_PAYABLE");
        if (!batch.pixKey || batch.requests.length === 0) throw new Error("BENEFICIARY_DATA_MISSING");
        if (batch.requests.some(row => !["PENDING", "FAILED", "CANCELLED"].includes(row.status) ||
          row.participationLine.prizeCreditedAt || row.participationLine.prizePayout ||
          (row.participationLine.prizeCents ?? 0) <= 0)) throw new Error("PRIZE_ALREADY_PAID");

        const externalReference = "prize_batch_" + batch.id;
        const changed = await tx.prizePaymentBatch.updateMany({
          where: { id: batch.id, status: batch.status, asaasTransferId: null },
          data: {
            status: "PROCESSING", asaasTransferStatus: "CREATING",
            asaasTransferFailureReason: null, asaasTransferReceiptUrl: null,
            transferRequestedAt: new Date(), reviewedAt: new Date(), reviewerId: user.id,
            paymentReference: externalReference,
          },
        });
        if (changed.count !== 1) throw new Error("ALREADY_PROCESSING");
        const requestChanges = await tx.prizePaymentRequest.updateMany({
          where: { batchId: batch.id, status: { in: ["PENDING", "FAILED", "CANCELLED"] } },
          data: {
            status: "PROCESSING", asaasTransferStatus: "CREATING",
            asaasTransferFailureReason: null, asaasTransferReceiptUrl: null,
            transferRequestedAt: new Date(), reviewedAt: new Date(), reviewerId: user.id,
            paymentReference: externalReference,
          },
        });
        if (requestChanges.count !== batch.requests.length) throw new Error("BATCH_REQUEST_STATE_CHANGED");
        await tx.auditEvent.create({
          data: {
            actorId: user.id, action: "PRIZE_ASAAS_BATCH_TRANSFER_REQUESTED",
            entityType: "PrizePaymentBatch", entityId: batch.id,
            metadata: { requestCount: batch.requests.length, netCents: batch.netCents, externalReference },
          },
        });
        return {
          kind: "BATCH" as const, id: batch.id, netCents: batch.netCents,
          pixKey: batch.pixKey, pixKeyType: batch.pixKeyType,
          externalReference,
        };
      }

      if (item.status === "PROCESSING" || item.asaasTransferId) throw new Error("ALREADY_PROCESSING");
      if (!["PENDING", "FAILED", "CANCELLED"].includes(item.status)) throw new Error("NOT_PAYABLE");
      if (!item.pixKey || !item.pixKeyType) throw new Error("BENEFICIARY_DATA_MISSING");
      if (item.participationLine.prizeCreditedAt || item.participationLine.prizePayout || (item.participationLine.prizeCents ?? 0) <= 0) throw new Error("PRIZE_ALREADY_PAID");
      const externalReference = "prize_request_" + item.id;
      const changed = await tx.prizePaymentRequest.updateMany({
        where: { id: item.id, status: item.status, asaasTransferId: null },
        data: {
          status: "PROCESSING", asaasTransferStatus: "CREATING",
          asaasTransferFailureReason: null, asaasTransferReceiptUrl: null,
          transferRequestedAt: new Date(), reviewedAt: new Date(), reviewerId: user.id,
          paymentReference: externalReference,
        },
      });
      if (changed.count !== 1) throw new Error("ALREADY_PROCESSING");
      await tx.auditEvent.create({
        data: {
          actorId: user.id, action: "PRIZE_ASAAS_TRANSFER_REQUESTED",
          entityType: "PrizePaymentRequest", entityId: item.id,
          metadata: { netCents: item.netCents, pixKeyType: item.pixKeyType, externalReference },
        },
      });
      return {
        kind: "REQUEST" as const, id: item.id, netCents: item.netCents,
        pixKey: item.pixKey,
        pixKeyType: item.pixKeyType, externalReference,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND" || code === "BATCH_NOT_FOUND") return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404, headers });
    if (code === "ALREADY_PROCESSING" || code === "BATCH_REQUEST_STATE_CHANGED") return NextResponse.json({ error: "Esta transferência já foi iniciada ou o lote mudou. Aguarde a conciliação; não envie outro Pix." }, { status: 409, headers });
    if (code === "NOT_PAYABLE" || code === "PRIZE_ALREADY_PAID") return NextResponse.json({ error: "Esta solicitação não está disponível para pagamento." }, { status: 409, headers });
    if (code === "BENEFICIARY_DATA_MISSING") return NextResponse.json({ error: "Dados protegidos do beneficiário indisponíveis. Solicite nova chave Pix." }, { status: 409, headers });
    return NextResponse.json({ error: "Não foi possível reservar a solicitação para pagamento." }, { status: 500, headers });
  }

  try {
    if (!transferData.pixKey) throw new Error("BENEFICIARY_DATA_MISSING");
    const transfer = await createAsaasPixTransfer({
      amountCents: transferData.netCents,
      pixKey: transferData.pixKey,
      pixKeyType: transferData.pixKeyType as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP",
      externalReference: transferData.externalReference,
    });
    if (transferData.kind === "BATCH") {
      await authPrisma.prizePaymentBatch.updateMany({
        where: { id: transferData.id, status: "PROCESSING", paymentReference: transferData.externalReference },
        data: { asaasTransferId: transfer.id, asaasTransferStatus: transfer.status ?? "PENDING" },
      });
      await authPrisma.prizePaymentRequest.updateMany({
        where: { batchId: transferData.id, status: "PROCESSING" },
        data: { asaasTransferId: transfer.id, asaasTransferStatus: transfer.status ?? "PENDING" },
      });
    } else {
      await authPrisma.prizePaymentRequest.updateMany({
        where: { id: transferData.id, status: "PROCESSING", paymentReference: transferData.externalReference },
        data: { asaasTransferId: transfer.id, asaasTransferStatus: transfer.status ?? "PENDING" },
      });
    }
    return NextResponse.json({
      success: true, status: "PROCESSING",
      message: "Transferência enviada à Asaas. O recibo só será marcado como pago após a confirmação do webhook.",
    }, { status: 202, headers });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
    if (status >= 400 && status < 500) {
      if (transferData.kind === "BATCH") {
        await authPrisma.prizePaymentBatch.updateMany({
          where: { id: transferData.id, status: "PROCESSING", asaasTransferId: null },
          data: { status: "PENDING", asaasTransferStatus: "REJECTED", asaasTransferFailureReason: "A Asaas rejeitou a solicitação. Verifique a configuração e os dados antes de tentar novamente." },
        });
        await authPrisma.prizePaymentRequest.updateMany({
          where: { batchId: transferData.id, status: "PROCESSING", asaasTransferId: null },
          data: { status: "PENDING", asaasTransferStatus: "REJECTED", asaasTransferFailureReason: "A Asaas rejeitou a solicitação. Verifique a configuração e os dados antes de tentar novamente." },
        });
      } else {
        await authPrisma.prizePaymentRequest.updateMany({
          where: { id: transferData.id, status: "PROCESSING", asaasTransferId: null },
          data: { status: "PENDING", asaasTransferStatus: "REJECTED", asaasTransferFailureReason: "A Asaas rejeitou a solicitação. Verifique a configuração e os dados antes de tentar novamente." },
        });
      }
      return NextResponse.json({ error: "A Asaas recusou a transferência. Nenhum pagamento foi confirmado; revise a chave e a configuração." }, { status: 502, headers });
    }
    return NextResponse.json({
      error: "Resultado inconclusivo na Asaas. A solicitação ficou bloqueada contra duplicidade; confira o painel e os webhooks antes de qualquer nova tentativa.",
      status: "PROCESSING",
    }, { status: 202, headers });
  }
}
