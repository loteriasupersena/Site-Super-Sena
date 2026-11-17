import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";
import { getAsaasPayment } from "@/modules/payments/asaas";
import { confirmPixPayment } from "@/modules/payments/confirm-payment";
import { recordUnexpectedExternalRefund } from "@/modules/payments/record-unexpected-refund";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
type AsaasWebhook = { id?: string; event?: string; payment?: { id?: string } };
function response(body: unknown, status: number) { return NextResponse.json(body, { status, headers }); }
async function quarantineEvent(input: { eventId: string; event: string; digest: string; reason: string; paymentId?: string }) {
  const data = {
    eventType: input.event,
    payloadDigest: input.digest,
    processedAt: new Date(),
    processingError: input.reason,
    ...(input.paymentId ? { paymentId: input.paymentId } : {}),
  };
  await authPrisma.webhookEvent.upsert({
    where: { provider_providerEventId: { provider: "ASAAS_PAYMENT", providerEventId: input.eventId } },
    create: {
      provider: "ASAAS_PAYMENT",
      providerEventId: input.eventId,
      ...data,
    },
    update: data,
  });
}
function tokenMatches(received: string | null, expected: string) {
  if (!received) return false;
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function POST(request: NextRequest) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!token || token.length < 32) return response({ error: "Webhook não configurado." }, 503);
  if (!tokenMatches(request.headers.get("asaas-access-token"), token)) return response({ error: "Autenticação inválida." }, 401);
  let raw = "";
  let body: AsaasWebhook;
  try {
    raw = await request.text();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_WEBHOOK_OBJECT");
    body = parsed as AsaasWebhook;
  } catch {
    const digest = createHash("sha256").update(raw).digest("hex");
    const eventId = "invalid_payload_" + digest;
    await authPrisma.webhookEvent.upsert({
      where: { provider_providerEventId: { provider: "ASAAS_PAYMENT", providerEventId: eventId } },
      create: { provider: "ASAAS_PAYMENT", providerEventId: eventId, eventType: "INVALID_PAYLOAD", payloadDigest: digest, processedAt: new Date(), processingError: "invalid_json" },
      update: { eventType: "INVALID_PAYLOAD", payloadDigest: digest, processedAt: new Date(), processingError: "invalid_json" },
    });
    return response({ received: true, quarantined: true }, 200);
  }

  const digest = createHash("sha256").update(raw).digest("hex");
  const event = typeof body.event === "string" ? body.event.trim().toUpperCase() : "";
  if (!["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_REFUNDED"].includes(event)) {
    return response({ received: true, ignored: true }, 200);
  }

  const eventId = typeof body.id === "string" && body.id.trim()
    ? body.id.trim()
    : "payload_" + digest;
  const paymentId = typeof body.payment?.id === "string" ? body.payment.id.trim() : "";
  if (!paymentId) {
    await authPrisma.webhookEvent.upsert({
      where: { provider_providerEventId: { provider: "ASAAS_PAYMENT", providerEventId: eventId } },
      create: { provider: "ASAAS_PAYMENT", providerEventId: eventId, eventType: event, payloadDigest: digest, processedAt: new Date(), processingError: "missing_payment_id" },
      update: { eventType: event, payloadDigest: digest, processedAt: new Date(), processingError: "missing_payment_id" },
    });
    return response({ received: true, quarantined: true }, 200);
  }
  try {
    const canonical = await getAsaasPayment(paymentId);
    if (canonical.id !== paymentId || canonical.billingType !== "PIX") {
      await quarantineEvent({ eventId, event, digest, reason: "provider_payment_not_matching_pix" });
      return response({ received: true, quarantined: true }, 200);
    }
    if (event === "PAYMENT_REFUNDED" && canonical.status !== "REFUNDED") return response({ error: "Estorno ainda não está confirmado no Asaas." }, 503);
    const payment = await authPrisma.payment.findFirst({
      where: { provider: "ASAAS", providerQrCodeId: canonical.pixQrCodeId ?? undefined },
      select: { id: true, purchaseId: true, amountCents: true, providerQrCodeId: true, purchase: { select: { totalCents: true } } },
    });
    if (!payment) return response({ error: "Vínculo do QR Code ainda não localizado." }, 503);
    if (canonical.pixQrCodeId !== payment.providerQrCodeId || canonical.externalReference !== "superquina_purchase_" + payment.purchaseId
      || !Number.isFinite(canonical.value) || Math.round((canonical.value ?? 0) * 100) !== payment.amountCents
      || payment.amountCents !== payment.purchase.totalCents) {
      await quarantineEvent({ eventId, event, digest, reason: "provider_payment_does_not_match_purchase", paymentId: payment.id });
      return response({ received: true, quarantined: true }, 200);
    }
    const prior = await authPrisma.webhookEvent.findUnique({ where: { provider_providerEventId: { provider: "ASAAS_PAYMENT", providerEventId: eventId } }, select: { processedAt: true } });
    if (prior?.processedAt) return response({ received: true, duplicate: true }, 200);
    await authPrisma.webhookEvent.upsert({
      where: { provider_providerEventId: { provider: "ASAAS_PAYMENT", providerEventId: eventId } },
      create: { provider: "ASAAS_PAYMENT", providerEventId: eventId, eventType: event, payloadDigest: digest, paymentId: payment.id },
      update: { eventType: event, payloadDigest: digest, paymentId: payment.id, processingError: null },
    });
    await authPrisma.payment.update({ where: { id: payment.id }, data: { providerPaymentId: canonical.id, providerStatus: canonical.status ?? event, providerStatusDetail: event } });
    if (event === "PAYMENT_CONFIRMED" && canonical.status !== "RECEIVED") {
      // PAYMENT_CONFIRMED means the payer completed the payment, but the funds
      // may not yet be available. Acknowledge it and wait for PAYMENT_RECEIVED;
      // do not credit the player or make Asaas retry a valid notification.
      await authPrisma.webhookEvent.updateMany({
        where: { provider: "ASAAS_PAYMENT", providerEventId: eventId },
        data: { processedAt: new Date(), processingError: null },
      });
      return response({ received: true, awaitingReceipt: true }, 200);
    }
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      if (canonical.status !== "RECEIVED") return response({ error: "Pagamento ainda não está recebido no Asaas." }, 503);
      const result = await confirmPixPayment(authPrisma, { paymentId: payment.id, providerStatus: canonical.status, providerStatusDetail: event });
      if (result.outcome === "late_or_unavailable") {
        await authPrisma.webhookEvent.updateMany({ where: { provider: "ASAAS_PAYMENT", providerEventId: eventId }, data: { processedAt: new Date(), processingError: "reconciliation_required" } });
        return response({ received: true, reconciliationRequired: true }, 200);
      }
      if (result.outcome === "not_pending") {
        await authPrisma.webhookEvent.updateMany({
          where: { provider: "ASAAS_PAYMENT", providerEventId: eventId },
          data: { processedAt: new Date(), processingError: "purchase_not_pending" },
        });
        return response({ received: true, quarantined: true }, 200);
      }
    } else {
      await recordUnexpectedExternalRefund(authPrisma, { purchaseId: payment.purchaseId, paymentId: payment.id, providerStatus: canonical.status ?? event, source: "webhook" });
    }
    await authPrisma.webhookEvent.updateMany({ where: { provider: "ASAAS_PAYMENT", providerEventId: eventId }, data: { processedAt: new Date(), processingError: null } });
    return response({ received: true }, 200);
  } catch { return response({ error: "Falha ao reconciliar pagamento Asaas; o evento poderá ser reenviado." }, 503); }
}
