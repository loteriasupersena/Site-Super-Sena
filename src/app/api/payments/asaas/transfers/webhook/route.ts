import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";
import { decryptStorePixKey } from "@/lib/wallet/store-pix-key";
import { normalizePixKeyForComparison, type PixKeyType } from "@/lib/wallet/pix-key";
import { getAsaasTransfer } from "@/modules/payments/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TransferNotification = {
  id?: string;
  event?: string;
  transfer?: { id?: string; externalReference?: string };
};

function response(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function validToken(received: string | null, expected: string) {
  if (!received) return false;
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Reconciles only an existing coupon payout; a webhook can never initiate a transfer. */
export async function POST(request: NextRequest) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!token || token.length < 32) return response({ error: "Webhook não configurado." }, 503);
  if (!validToken(request.headers.get("asaas-access-token"), token)) {
    return response({ error: "Autenticação inválida." }, 401);
  }

  let raw: string;
  let body: TransferNotification;
  try {
    raw = await request.text();
    body = JSON.parse(raw) as TransferNotification;
  } catch {
    return response({ error: "Payload inválido." }, 400);
  }

  const eventId = body.id?.trim();
  const notificationEvent = body.event?.trim().toUpperCase();
  const transferId = body.transfer?.id?.trim();
  const externalReference = body.transfer?.externalReference?.trim();
  if (!eventId || !notificationEvent || !transferId || !externalReference) {
    return response({ error: "Evento de transferência incompleto." }, 400);
  }
  const acceptedEvents = new Set([
    "TRANSFER_CREATED", "TRANSFER_PENDING", "TRANSFER_IN_BANK_PROCESSING",
    "TRANSFER_BLOCKED", "TRANSFER_DONE", "TRANSFER_FAILED", "TRANSFER_CANCELLED",
  ]);
  if (!acceptedEvents.has(notificationEvent)) return response({ received: true, ignored: true }, 200);

  try {
    // Notification body is only a wake-up signal. Fetch authoritative provider state.
    const transfer = await getAsaasTransfer(transferId);
    if (transfer.id !== transferId || transfer.externalReference !== externalReference) {
      return response({ error: "A transferência consultada não corresponde à notificação." }, 409);
    }
    if (transfer.operationType !== "PIX" || !Number.isFinite(transfer.value)) {
      return response({ error: "Dados da transferência incompletos ou modalidade inválida." }, 422);
    }

    const payout = await authPrisma.couponPayout.findUnique({
      where: { externalReference },
      select: {
        id: true, couponId: true, storeId: true, requestedById: true, kind: true, status: true,
        amountCents: true, providerTransferId: true, pixKeyCiphertext: true,
        pixKeyType: true, coupon: { select: { status: true } },
      },
    });
    if (!payout) return response({ error: "Operação de prêmio não localizada." }, 503);
    if (payout.providerTransferId && payout.providerTransferId !== transferId) {
      return response({ error: "O ID da transferência diverge do registro interno." }, 409);
    }
    if (Math.round((transfer.value ?? 0) * 100) !== payout.amountCents) {
      return response({ error: "O valor da transferência diverge do prêmio registrado." }, 409);
    }

    const status = transfer.status?.toUpperCase();
    if (status === "DONE") {
      if (!payout.pixKeyCiphertext || !payout.pixKeyType || !transfer.bankAccount?.pixAddressKey) {
        return response({ error: "Não foi possível validar o destino Pix da transferência." }, 409);
      }
      const savedKey = decryptStorePixKey(payout.pixKeyCiphertext);
      const expectedKey = normalizePixKeyForComparison(savedKey, payout.pixKeyType as PixKeyType);
      const actualKey = normalizePixKeyForComparison(
        transfer.bankAccount.pixAddressKey,
        payout.pixKeyType as PixKeyType,
      );
      if (expectedKey !== actualKey) return response({ error: "A chave de destino diverge do registro interno." }, 409);
    }

    const payloadDigest = createHash("sha256").update(raw).digest("hex");
    const outcome = await authPrisma.$transaction(async (tx) => {
      const prior = await tx.asaasWebhookEvent.findUnique({
        where: { providerEventId: eventId }, select: { processedAt: true },
      });
      if (prior?.processedAt) return "DUPLICATE";

      await tx.asaasWebhookEvent.upsert({
        where: { providerEventId: eventId },
        create: { providerEventId: eventId, eventType: status ?? notificationEvent, payloadDigest },
        update: { eventType: status ?? notificationEvent, payloadDigest, processingError: null },
      });

      if (payout.status === "PAID") {
        await tx.asaasWebhookEvent.update({
          where: { providerEventId: eventId },
          data: { processedAt: new Date(), processingError: null },
        });
        return "ALREADY_PAID";
      }

      if (status === "DONE") {
        const expectedCouponStatus = payout.kind === "CUSTOMER_REDEMPTION" ? "WINNER" : "STORE_CLAIMABLE";
        const finalCouponStatus = payout.kind === "CUSTOMER_REDEMPTION" ? "REDEEMED" : "STORE_REDEEMED";
        const couponUpdate = await tx.coupon.updateMany({
          where: { id: payout.couponId, storeId: payout.storeId, status: expectedCouponStatus },
          data: payout.kind === "CUSTOMER_REDEMPTION"
            ? { status: "REDEEMED", redeemedAt: new Date() }
            : { status: "STORE_REDEEMED", storeClaimedAt: new Date(), storeClaimedById: payout.requestedById },
        });
        if (couponUpdate.count !== 1) {
          const current = await tx.coupon.findUnique({ where: { id: payout.couponId }, select: { status: true } });
          if (current?.status !== finalCouponStatus) throw new Error("COUPON_PAYOUT_STATE_CONFLICT");
        }
        await tx.couponPayout.update({
          where: { id: payout.id },
          data: {
            status: "PAID", provider: "ASAAS", providerTransferId: transferId,
            providerStatus: status, providerReceiptUrl: transfer.transactionReceiptUrl ?? null,
            providerFailureReason: null, paidAt: new Date(),
          },
        });
      } else if (status === "FAILED" || status === "CANCELLED") {
        await tx.couponPayout.update({
          where: { id: payout.id },
          data: {
            status: "FAILED", provider: "ASAAS", providerTransferId: transferId,
            providerStatus: status, providerFailureReason: transfer.failReason ?? status,
          },
        });
      } else {
        await tx.couponPayout.update({
          where: { id: payout.id },
          data: {
            status: "PROCESSING", provider: "ASAAS", providerTransferId: transferId,
            providerStatus: status ?? "PENDING",
          },
        });
      }

      await tx.asaasWebhookEvent.update({
        where: { providerEventId: eventId },
        data: { processedAt: new Date(), processingError: null },
      });
      await tx.auditEvent.create({
        data: {
          action: status === "DONE" ? "COUPON_PAYOUT_CONFIRMED"
            : status === "FAILED" || status === "CANCELLED" ? "COUPON_PAYOUT_FAILED"
            : "COUPON_PAYOUT_STATUS_UPDATED",
          entityType: "CouponPayout", entityId: payout.id,
          metadata: {
            couponId: payout.couponId, storeId: payout.storeId, requestedById: payout.requestedById, kind: payout.kind,
            amountCents: payout.amountCents, provider: "ASAAS", transferId, providerStatus: status,
          },
        },
      });
      return status === "DONE" ? "PAID" : status === "FAILED" || status === "CANCELLED" ? "FAILED" : "PROCESSING";
    }, { isolationLevel: "Serializable" });

    return response({ received: true, outcome }, 200);
  } catch {
    return response({ error: "Falha ao reconciliar transferência; o Asaas poderá reenviar." }, 503);
  }
}
