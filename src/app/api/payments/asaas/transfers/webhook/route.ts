import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";
import { registerNumericPrizePayout } from "@/modules/rounds/register-numeric-prize-payout";
import { getAsaasTransfer } from "@/modules/payments/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

type TransferWebhook = {
  id?: string;
  event?: string;
  transfer?: {
    id?: string;
    status?: string;
    externalReference?: string;
    transactionReceiptUrl?: string | null;
    failReason?: string | null;
    value?: number;
    operationType?: string;
    bankAccount?: { pixAddressKey?: string | null } | null;
  };
};

function safeTokenMatch(received: string | null, expected: string) {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function response(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers });
}

function normalizePix(value: string, type: string) {
  return ["CPF", "CNPJ", "PHONE"].includes(type)
    ? value.replace(/\D/g, "")
    : value.trim().toLowerCase();
}

function verifyPixBeneficiary(expectedPlain: string | null, type: string | null, actual: string | null | undefined) {
  if (!expectedPlain || !type || !actual) throw new Error("TRANSFER_BENEFICIARY_UNVERIFIABLE");
  if (normalizePix(expectedPlain, type) !== normalizePix(actual, type)) {
    throw new Error("TRANSFER_BENEFICIARY_MISMATCH");
  }
}

export async function POST(request: NextRequest) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!token || token.length < 32) return response({ error: "Webhook não configurado." }, 503);
  if (!safeTokenMatch(request.headers.get("asaas-access-token"), token)) {
    return response({ error: "Autenticação inválida." }, 401);
  }

  let raw: string;
  let body: TransferWebhook;
  try {
    raw = await request.text();
    body = JSON.parse(raw) as TransferWebhook;
  } catch {
    return response({ error: "Payload inválido." }, 400);
  }

  const eventId = body.id?.trim();
  const notificationEvent = body.event?.trim().toUpperCase();
  let event = notificationEvent;
  let transfer = body.transfer;
  const transferId = transfer?.id?.trim();
  const externalReference = transfer?.externalReference?.trim();
  if (!eventId || !event || !transferId || !externalReference) {
    return response({ error: "Evento de transferência incompleto." }, 400);
  }

  const allowed = new Set([
    "TRANSFER_CREATED", "TRANSFER_PENDING", "TRANSFER_IN_BANK_PROCESSING",
    "TRANSFER_BLOCKED", "TRANSFER_DONE", "TRANSFER_FAILED", "TRANSFER_CANCELLED",
  ]);
  if (!event || !allowed.has(event)) return response({ received: true, ignored: true }, 200);

  // A webhook is only a wake-up signal. Approval is based on a fresh GET of the
  // transfer, so an out-of-order/intermediate notification cannot decide the result.
  try {
    const current = await getAsaasTransfer(transferId);
    if (current.id !== transferId || current.externalReference !== externalReference) {
      return response({ error: "A consulta atual do Asaas não corresponde à transferência recebida." }, 409);
    }
    const currentStatus = current.status?.trim().toUpperCase();
    event = currentStatus === "DONE" ? "TRANSFER_DONE"
      : currentStatus === "FAILED" ? "TRANSFER_FAILED"
      : currentStatus === "CANCELLED" ? "TRANSFER_CANCELLED"
      : "TRANSFER_PENDING";
    transfer = { ...transfer, ...current, externalReference: current.externalReference ?? undefined };
  } catch {
    // Do not process the webhook snapshot when the authoritative lookup fails.
    return response({ error: "Não foi possível confirmar o estado atual da transferência no Asaas." }, 503);
  }

  const digest = createHash("sha256").update(raw).digest("hex");
  try {
    const outcome = await authPrisma.$transaction(async (tx) => {
      const prior = await tx.webhookEvent.findUnique({
        where: { provider_providerEventId: { provider: "ASAAS_TRANSFER", providerEventId: eventId } },
        select: { processedAt: true },
      });
      if (prior?.processedAt) return "DUPLICATE";

      if (externalReference.startsWith("prize_batch_")) {
        const batchId = externalReference.slice("prize_batch_".length);
        if (!/^[A-Za-z0-9_-]{8,100}$/.test(batchId)) throw new Error("BATCH_REFERENCE_INVALID");
        const batch = await tx.prizePaymentBatch.findUnique({
          where: { id: batchId },
          select: {
            id: true, status: true, paymentReference: true, asaasTransferId: true,
            netCents: true, reviewerId: true, pixKey: true, pixKeyType: true,
            requests: { select: { id: true, participationLineId: true, status: true } },
          },
        });
        if (!batch || batch.paymentReference !== externalReference) throw new Error("BATCH_NOT_FOUND");
        if (batch.asaasTransferId && batch.asaasTransferId !== transferId) throw new Error("TRANSFER_MISMATCH");
        if (event === "TRANSFER_DONE" &&
          (!Number.isFinite(transfer?.value) ||
           Math.round((transfer?.value ?? 0) * 100) !== batch.netCents ||
           transfer?.operationType !== "PIX")) throw new Error("TRANSFER_VALUE_MISMATCH");
        if (event === "TRANSFER_DONE") {
          verifyPixBeneficiary(batch.pixKey, batch.pixKeyType, transfer?.bankAccount?.pixAddressKey);
        }

        await tx.webhookEvent.upsert({
          where: { provider_providerEventId: { provider: "ASAAS_TRANSFER", providerEventId: eventId } },
          create: { provider: "ASAAS_TRANSFER", providerEventId: eventId, eventType: event, payloadDigest: digest, processedAt: new Date() },
          update: { eventType: event, payloadDigest: digest, processedAt: new Date(), processingError: null },
        });

        if (batch.status === "PAID") return "ALREADY_PAID";
        if (event === "TRANSFER_DONE") {
          if (!batch.reviewerId || batch.requests.length === 0 ||
              !["PROCESSING", "FAILED", "CANCELLED"].includes(batch.status) ||
              batch.requests.some(item => !["PROCESSING", "FAILED", "CANCELLED"].includes(item.status))) {
            throw new Error("BATCH_NOT_READY");
          }
          // Each line is settled separately, but only after the single aggregate Pix is confirmed.
          for (const item of batch.requests) {
            await registerNumericPrizePayout(tx, {
              lineId: item.participationLineId,
              actorId: batch.reviewerId,
              channel: "PLATFORM_PIX",
              reference: externalReference,
              expectedRequestStatus: item.status as "PROCESSING" | "FAILED" | "CANCELLED",
            });
          }
          await tx.prizePaymentBatch.update({
            where: { id: batch.id },
            data: {
              status: "PAID", asaasTransferId: transferId,
              asaasTransferStatus: transfer?.status ?? "DONE",
              asaasTransferReceiptUrl: transfer?.transactionReceiptUrl ?? null,
              asaasTransferFailureReason: null,
            },
          });
          await tx.prizePaymentRequest.updateMany({
            where: { batchId: batch.id },
            data: {
              asaasTransferId: transferId,
              asaasTransferStatus: transfer?.status ?? "DONE",
              asaasTransferReceiptUrl: transfer?.transactionReceiptUrl ?? null,
              asaasTransferFailureReason: null,
              pixKey: null, pixKeyEncrypted: null, holderName: null, holderNameEncrypted: null, holderCpfEncrypted: null,
            },
          });
          return "BATCH_PAID";
        }

        const status = event === "TRANSFER_FAILED" ? "FAILED"
          : event === "TRANSFER_CANCELLED" ? "CANCELLED" : "PROCESSING";
        const transferStatus = transfer?.status ?? event.replace("TRANSFER_", "");
        const failure = status === "FAILED" || status === "CANCELLED" ? transfer?.failReason ?? event : null;
        await tx.prizePaymentBatch.update({
          where: { id: batch.id },
          data: { status, asaasTransferId: transferId, asaasTransferStatus: transferStatus, asaasTransferFailureReason: failure },
        });
        await tx.prizePaymentRequest.updateMany({
          where: { batchId: batch.id },
          data: { status, asaasTransferId: transferId, asaasTransferStatus: transferStatus, asaasTransferFailureReason: failure },
        });
        await tx.auditEvent.create({
          data: {
            action: status === "FAILED" ? "PRIZE_ASAAS_BATCH_TRANSFER_FAILED"
              : status === "CANCELLED" ? "PRIZE_ASAAS_BATCH_TRANSFER_CANCELLED" : "PRIZE_ASAAS_BATCH_TRANSFER_UPDATED",
            entityType: "PrizePaymentBatch", entityId: batch.id,
            metadata: { event, notificationEvent, transferId, transferStatus, failReason: failure },
          },
        });
        return status;
      }

      if (externalReference.startsWith("wallet_withdrawal_")) {
        const withdrawalId = externalReference.slice("wallet_withdrawal_".length);
        if (!/^[A-Za-z0-9_-]{8,100}$/.test(withdrawalId)) throw new Error("WITHDRAWAL_REFERENCE_INVALID");
        await tx.$queryRaw`SELECT "id" FROM "Withdrawal" WHERE "id" = ${withdrawalId} FOR UPDATE`;
        const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId },
          select: { id: true, status: true, amountCents: true, paymentReference: true, asaasTransferId: true, reviewedById: true, userId: true, pixKey: true, pixKeyType: true } });
        if (!withdrawal || withdrawal.paymentReference !== externalReference) throw new Error("WITHDRAWAL_NOT_FOUND");
        if (withdrawal.asaasTransferId && withdrawal.asaasTransferId !== transferId) throw new Error("TRANSFER_MISMATCH");
        if (event === "TRANSFER_DONE" &&
          (!Number.isFinite(transfer?.value) || Math.round((transfer?.value ?? 0) * 100) !== withdrawal.amountCents ||
           transfer?.operationType !== "PIX")) throw new Error("TRANSFER_VALUE_MISMATCH");
        if (event === "TRANSFER_DONE") {
          verifyPixBeneficiary(withdrawal.pixKey, withdrawal.pixKeyType, transfer?.bankAccount?.pixAddressKey);
        }
        await tx.webhookEvent.upsert({
          where: { provider_providerEventId: { provider: "ASAAS_TRANSFER", providerEventId: eventId } },
          create: { provider: "ASAAS_TRANSFER", providerEventId: eventId, eventType: event, payloadDigest: digest, processedAt: new Date() },
          update: { eventType: event, payloadDigest: digest, processedAt: new Date(), processingError: null },
        });
        if (withdrawal.status === "PAID") return "WITHDRAWAL_ALREADY_PAID";
        if (event === "TRANSFER_DONE") {
          if (!withdrawal.reviewedById || !["PROCESSING", "FAILED"].includes(withdrawal.status)) throw new Error("WITHDRAWAL_NOT_READY");
          const changed = await tx.withdrawal.updateMany({
            where: { id: withdrawal.id, status: { in: ["PROCESSING", "FAILED"] }, paymentReference: externalReference },
            data: { status: "PAID", asaasTransferId: transferId, asaasTransferStatus: transfer?.status ?? "DONE",
              providerRef: transferId, asaasTransferFailureReason: null, pixKey: null, pixKeyEncrypted: null, holderName: null, holderNameEncrypted: null, holderCpfEncrypted: null },
          });
          if (changed.count !== 1) throw new Error("WITHDRAWAL_STATE_CHANGED");
          await tx.ledgerEntry.create({ data: {
            userId: withdrawal.userId, withdrawalId: withdrawal.id, type: "WITHDRAWAL_PAID",
            amountCents: 0, currency: "BRL", idempotencyKey: "withdrawal-paid:" + withdrawal.id,
            description: "Confirmação da transferência Pix Asaas " + transferId,
          } });
          await tx.withdrawalStatusHistory.create({ data: { withdrawalId: withdrawal.id, fromStatus: withdrawal.status,
            toStatus: "PAID", note: "Transferência Pix confirmada pela Asaas (TRANSFER_DONE). Referência: " + transferId } });
          await tx.auditEvent.create({ data: { actorId: withdrawal.reviewedById, action: "WITHDRAWAL_ASAAS_TRANSFER_CONFIRMED",
            entityType: "Withdrawal", entityId: withdrawal.id, metadata: { transferId, amountCents: withdrawal.amountCents, event, notificationEvent } } });
          return "WITHDRAWAL_PAID";
        }
        const status = event === "TRANSFER_FAILED" || event === "TRANSFER_CANCELLED" ? "FAILED" : "PROCESSING";
        await tx.withdrawal.update({ where: { id: withdrawal.id }, data: {
          status, asaasTransferId: transferId, asaasTransferStatus: transfer?.status ?? event.replace("TRANSFER_", ""),
          asaasTransferFailureReason: status === "FAILED" ? transfer?.failReason ?? event : null,
        } });
        await tx.withdrawalStatusHistory.create({ data: { withdrawalId: withdrawal.id, fromStatus: withdrawal.status,
          toStatus: status, note: status === "FAILED" ? "Transferência Asaas não concluída: " + (transfer?.failReason ?? event) : "Atualização da transferência Asaas: " + event } });
        await tx.auditEvent.create({ data: { actorId: withdrawal.reviewedById, action: status === "FAILED" ? "WITHDRAWAL_ASAAS_TRANSFER_FAILED" : "WITHDRAWAL_ASAAS_TRANSFER_UPDATED",
          entityType: "Withdrawal", entityId: withdrawal.id, metadata: { transferId, event, notificationEvent, failReason: transfer?.failReason ?? null } } });
        return status === "FAILED" ? "WITHDRAWAL_FAILED" : "WITHDRAWAL_PROCESSING";
      }

      if (!externalReference.startsWith("prize_request_")) throw new Error("REQUEST_REFERENCE_INVALID");
      const requestId = externalReference.slice("prize_request_".length);
      if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) throw new Error("REQUEST_REFERENCE_INVALID");
      const requestRow = await tx.prizePaymentRequest.findUnique({
        where: { id: requestId },
        select: { id: true, status: true, asaasTransferId: true, paymentReference: true, participationLineId: true, reviewerId: true, netCents: true, pixKey: true, pixKeyType: true },
      });
      if (!requestRow || requestRow.paymentReference !== externalReference) throw new Error("REQUEST_NOT_FOUND");
      if (requestRow.asaasTransferId && requestRow.asaasTransferId !== transferId) throw new Error("TRANSFER_MISMATCH");
      if (event === "TRANSFER_DONE" &&
        (!Number.isFinite(transfer?.value) ||
         Math.round((transfer?.value ?? 0) * 100) !== requestRow.netCents ||
         transfer?.operationType !== "PIX")) throw new Error("TRANSFER_VALUE_MISMATCH");
      if (event === "TRANSFER_DONE") {
        verifyPixBeneficiary(requestRow.pixKey, requestRow.pixKeyType, transfer?.bankAccount?.pixAddressKey);
      }

      await tx.webhookEvent.upsert({
        where: { provider_providerEventId: { provider: "ASAAS_TRANSFER", providerEventId: eventId } },
        create: { provider: "ASAAS_TRANSFER", providerEventId: eventId, eventType: event, payloadDigest: digest, processedAt: new Date() },
        update: { eventType: event, payloadDigest: digest, processedAt: new Date(), processingError: null },
      });

      if (requestRow.status === "PAID") return "ALREADY_PAID";
      if (event === "TRANSFER_DONE") {
        if (!requestRow.reviewerId) throw new Error("PAYOUT_REVIEWER_MISSING");
        await registerNumericPrizePayout(tx, {
          lineId: requestRow.participationLineId,
          actorId: requestRow.reviewerId,
          channel: "PLATFORM_PIX",
          reference: externalReference,
          expectedRequestStatus: requestRow.status as "PROCESSING" | "FAILED" | "CANCELLED",
        });
        await tx.prizePaymentRequest.update({
          where: { id: requestId },
          data: {
            asaasTransferId: transferId, asaasTransferStatus: transfer?.status ?? "DONE",
            asaasTransferReceiptUrl: transfer?.transactionReceiptUrl ?? null,
            asaasTransferFailureReason: null,
            pixKeyEncrypted: null, holderNameEncrypted: null, holderCpfEncrypted: null,
          },
        });
        return "PAID";
      }
      const status = event === "TRANSFER_FAILED" ? "FAILED"
        : event === "TRANSFER_CANCELLED" ? "CANCELLED" : "PROCESSING";
      await tx.prizePaymentRequest.update({
        where: { id: requestId },
        data: {
          status, asaasTransferId: transferId,
          asaasTransferStatus: transfer?.status ?? event.replace("TRANSFER_", ""),
          asaasTransferFailureReason: status === "FAILED" || status === "CANCELLED" ? transfer?.failReason ?? event : null,
        },
      });
      await tx.auditEvent.create({
        data: {
          action: status === "FAILED" ? "PRIZE_ASAAS_TRANSFER_FAILED"
            : status === "CANCELLED" ? "PRIZE_ASAAS_TRANSFER_CANCELLED" : "PRIZE_ASAAS_TRANSFER_UPDATED",
          entityType: "PrizePaymentRequest", entityId: requestId,
          metadata: { event, notificationEvent, transferId, transferStatus: transfer?.status ?? null, failReason: transfer?.failReason ?? null },
        },
      });
      return status;
    }, { isolationLevel: "Serializable" });

    return response({ received: true, outcome }, 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "REQUEST_NOT_FOUND" || code === "BATCH_NOT_FOUND" || code === "WITHDRAWAL_NOT_FOUND") return response({ error: "Solicitação ou lote não localizado." }, 404);
    if (code === "TRANSFER_MISMATCH") return response({ error: "ID da transferência não corresponde à solicitação." }, 409);
    if (code === "TRANSFER_VALUE_MISMATCH") return response({ error: "Valor ou modalidade da transferência não corresponde ao registro." }, 409);
    if (code === "TRANSFER_BENEFICIARY_MISMATCH" || code === "TRANSFER_BENEFICIARY_UNVERIFIABLE") return response({ error: "A chave Pix de destino não pôde ser confirmada contra o cadastro do beneficiário." }, 409);
    return response({ error: "Falha ao processar evento; o Asaas poderá reenviar." }, 503);
  }
}
