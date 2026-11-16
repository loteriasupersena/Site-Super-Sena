import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";
import { registerNumericPrizePayout } from "@/modules/rounds/register-numeric-prize-payout";

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
  const event = body.event?.trim().toUpperCase();
  const transfer = body.transfer;
  const transferId = transfer?.id?.trim();
  const externalReference = transfer?.externalReference?.trim();
  if (!eventId || !event || !transferId || !externalReference?.startsWith("prize_request_")) {
    return response({ error: "Evento de transferência incompleto." }, 400);
  }
  const requestId = externalReference.slice("prize_request_".length);
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) return response({ error: "Referência inválida." }, 400);

  const allowed = new Set([
    "TRANSFER_CREATED", "TRANSFER_PENDING", "TRANSFER_IN_BANK_PROCESSING",
    "TRANSFER_BLOCKED", "TRANSFER_DONE", "TRANSFER_FAILED", "TRANSFER_CANCELLED",
  ]);
  if (!allowed.has(event)) return response({ received: true, ignored: true }, 200);

  const digest = createHash("sha256").update(raw).digest("hex");
  try {
    const outcome = await authPrisma.$transaction(async (tx) => {
      const prior = await tx.webhookEvent.findUnique({
        where: { provider_providerEventId: { provider: "ASAAS_TRANSFER", providerEventId: eventId } },
        select: { processedAt: true },
      });
      if (prior?.processedAt) return "DUPLICATE";

      const requestRow = await tx.prizePaymentRequest.findUnique({
        where: { id: requestId },
        select: { id: true, status: true, asaasTransferId: true, paymentReference: true, participationLineId: true, reviewerId: true, netCents: true },
      });
      if (!requestRow || requestRow.paymentReference !== externalReference) throw new Error("REQUEST_NOT_FOUND");
      if (requestRow.asaasTransferId && requestRow.asaasTransferId !== transferId) throw new Error("TRANSFER_MISMATCH");
      if (event === "TRANSFER_DONE" && (!Number.isFinite(transfer?.value) || Math.round((transfer?.value ?? 0) * 100) !== requestRow.netCents || transfer?.operationType !== "PIX")) throw new Error("TRANSFER_VALUE_MISMATCH");

      await tx.webhookEvent.upsert({
        where: { provider_providerEventId: { provider: "ASAAS_TRANSFER", providerEventId: eventId } },
        create: {
          provider: "ASAAS_TRANSFER", providerEventId: eventId,
          eventType: event, payloadDigest: digest, processedAt: new Date(),
        },
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
          expectedRequestStatus: requestRow.status as "PROCESSING" | "FAILED" | "CANCELLED" | "PENDING",
        });
        await tx.prizePaymentRequest.update({
          where: { id: requestId },
          data: {
            asaasTransferId: transferId,
            asaasTransferStatus: transfer?.status ?? "DONE",
            asaasTransferReceiptUrl: transfer?.transactionReceiptUrl ?? null,
            asaasTransferFailureReason: null,
            pixKeyEncrypted: null, holderNameEncrypted: null, holderCpfEncrypted: null,
          },
        });
        return "PAID";
      }
      if (["FAILED", "CANCELLED"].includes(requestRow.status) && !["TRANSFER_DONE"].includes(event)) return "TERMINAL_STATE";
      let status: "PROCESSING" | "FAILED" | "CANCELLED" = "PROCESSING";
      if (event === "TRANSFER_FAILED") status = "FAILED";
      else if (event === "TRANSFER_CANCELLED") status = "CANCELLED";

      const data = {
        status,
        asaasTransferId: transferId,
        asaasTransferStatus: transfer?.status ?? event.replace("TRANSFER_", ""),
        asaasTransferFailureReason: status === "FAILED" || status === "CANCELLED" ? transfer?.failReason ?? event : null,
      };
      await tx.prizePaymentRequest.update({
        where: { id: requestId },
        data,
      });
      await tx.auditEvent.create({
        data: {
          action: status === "FAILED" ? "PRIZE_ASAAS_TRANSFER_FAILED" : status === "CANCELLED" ? "PRIZE_ASAAS_TRANSFER_CANCELLED" : "PRIZE_ASAAS_TRANSFER_UPDATED",
          entityType: "PrizePaymentRequest", entityId: requestId,
          metadata: {
            event, transferId, transferStatus: transfer?.status ?? null,
            failReason: status === "FAILED" || status === "CANCELLED" ? transfer?.failReason ?? null : null,
          },
        },
      });
      return status;
    }, { isolationLevel: "Serializable" });

    return response({ received: true, outcome }, 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "REQUEST_NOT_FOUND") return response({ error: "Solicitação não localizada." }, 404);
    if (code === "TRANSFER_MISMATCH") return response({ error: "ID da transferência não corresponde à solicitação." }, 409);
    return response({ error: "Falha ao processar evento; o Asaas poderá reenviar." }, 503);
  }
}
