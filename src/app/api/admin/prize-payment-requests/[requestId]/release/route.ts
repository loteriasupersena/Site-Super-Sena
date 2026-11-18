import { NextRequest, NextResponse } from "next/server";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

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
  if (user.role !== "ADMIN" || user.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });

  const { requestId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404, headers });

  try {
    const result = await authPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PrizePaymentRequest" WHERE "id" = ${requestId} FOR UPDATE`;
      const item = await tx.prizePaymentRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true, purchaseId: true, participationLineId: true, batchId: true, status: true,
          grossCents: true, administrativeFeeCents: true, transactionFeeCents: true, netCents: true,
          pixKeyMasked: true, pixKeyType: true, holderCpfMasked: true, requestedAt: true,
          asaasTransferId: true, asaasTransferStatus: true,
        },
      });
      if (!item) throw new Error("NOT_FOUND");
      const reviewedAt = new Date();
      const terminalTransfer = ["FAILED", "CANCELLED", "REJECTED"].includes(item.asaasTransferStatus ?? "");
      if (!["PENDING", "FAILED", "CANCELLED"].includes(item.status) || (item.asaasTransferId && !terminalTransfer)) throw new Error("NOT_PENDING");

      if (item.batchId) {
        await tx.$queryRaw`SELECT "id" FROM "PrizePaymentBatch" WHERE "id" = ${item.batchId} FOR UPDATE`;
        const batch = await tx.prizePaymentBatch.findUnique({
          where: { id: item.batchId },
          select: {
            id: true, purchaseId: true, status: true, asaasTransferId: true, asaasTransferStatus: true,
            requests: { select: { id: true, status: true, asaasTransferId: true, asaasTransferStatus: true } },
          },
        });
        if (!batch || !batch.requests.length) throw new Error("NOT_PENDING");
        const terminalStatuses: ("PENDING" | "FAILED" | "CANCELLED")[] = ["PENDING", "FAILED", "CANCELLED"];
        const safeTransfer = (id: string | null, status: string | null) =>
          !id || ["FAILED", "CANCELLED", "REJECTED"].includes(status ?? "");
        if (!terminalStatuses.includes(batch.status) || !safeTransfer(batch.asaasTransferId, batch.asaasTransferStatus) ||
            batch.requests.some(row => !terminalStatuses.includes(row.status) || !safeTransfer(row.asaasTransferId, row.asaasTransferStatus))) {
          throw new Error("NOT_PENDING");
        }
        const batchChanged = await tx.prizePaymentBatch.updateMany({
          where: { id: batch.id, status: batch.status, asaasTransferId: batch.asaasTransferId },
          data: {
            status: "REJECTED", pixKey: null, asaasTransferId: null, asaasTransferStatus: null,
            asaasTransferReceiptUrl: null, asaasTransferFailureReason: null,
            transferRequestedAt: null, paymentReference: null, reviewedAt, reviewerId: user.id,
          },
        });
        if (batchChanged.count !== 1) throw new Error("NOT_PENDING");
        const requestsChanged = await tx.prizePaymentRequest.updateMany({
          where: { batchId: batch.id, status: { in: terminalStatuses } },
          data: {
            status: "REJECTED", batchId: null, pixKey: null, pixKeyEncrypted: null, holderName: null,
            holderNameEncrypted: null, holderCpfEncrypted: null,
            asaasTransferId: null, asaasTransferStatus: null, asaasTransferReceiptUrl: null,
            asaasTransferFailureReason: null, transferRequestedAt: null, paymentReference: null,
            reviewedAt, reviewerId: user.id,
            note: "Lote liberado pela administração. O ganhador poderá solicitar novamente.",
          },
        });
        if (requestsChanged.count !== batch.requests.length) throw new Error("NOT_PENDING");
        await tx.auditEvent.create({ data: {
          actorId: user.id, action: "PRIZE_PIX_BATCH_VALUE_RELEASED",
          entityType: "PrizePaymentBatch", entityId: batch.id,
          metadata: { purchaseId: batch.purchaseId, requestCount: batch.requests.length,
            previousStatus: batch.status, status: "REJECTED", released: true,
            reviewedAt: reviewedAt.toISOString() },
        } });
        return { id: batch.id, status: "REJECTED" as const, releasedRequests: requestsChanged.count, reviewedAt };
      }

      const changed = await tx.prizePaymentRequest.updateMany({
        where: { id: item.id, status: item.status, asaasTransferId: item.asaasTransferId },
        data: {
          status: "REJECTED", pixKey: null,
          pixKeyEncrypted: null, holderName: null, holderNameEncrypted: null, holderCpfEncrypted: null,
          asaasTransferId: null, asaasTransferStatus: null, asaasTransferReceiptUrl: null,
          asaasTransferFailureReason: null, transferRequestedAt: null, paymentReference: null,
          reviewedAt, reviewerId: user.id,
          note: "Valor liberado pela administração. O ganhador poderá solicitar novamente quando desejar.",
        },
      });
      if (changed.count !== 1) throw new Error("NOT_PENDING");
      await tx.auditEvent.create({ data: {
        actorId: user.id, action: "PRIZE_PIX_VALUE_RELEASED",
        entityType: "PrizePaymentRequest", entityId: item.id,
        metadata: {
          purchaseId: item.purchaseId, participationLineId: item.participationLineId,
          previousStatus: item.status, status: "REJECTED", released: true,
          grossCents: item.grossCents, administrativeFeeCents: item.administrativeFeeCents,
          transactionFeeCents: item.transactionFeeCents, netCents: item.netCents,
          pixKeyMasked: item.pixKeyMasked, pixKeyType: item.pixKeyType,
          holderCpfMasked: item.holderCpfMasked, requestedAt: item.requestedAt.toISOString(),
          asaasTransferId: item.asaasTransferId, asaasTransferStatus: item.asaasTransferStatus,
          reviewedAt: reviewedAt.toISOString(),
        },
      } });
      return { id: item.id, status: "REJECTED" as const, reviewedAt };
    });
    return NextResponse.json({
      success: true, request: result,
      message: "Valor liberado. O ganhador poderá enviar uma nova solicitação.",
    }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404, headers });
    if (code === "NOT_PENDING") return NextResponse.json({ error: "Esta solicitação já foi processada ou possui transferência iniciada." }, { status: 409, headers });
    return NextResponse.json({ error: "Não foi possível liberar o valor." }, { status: 500, headers });
  }
}
