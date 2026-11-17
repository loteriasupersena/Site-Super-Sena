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
function tokenMatches(received: string | null, expected: string) {
  if (!received) return false;
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function POST(request: NextRequest) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!token || token.length < 32) return response({ error: "Webhook não configurado." }, 503);
  if (!tokenMatches(request.headers.get("asaas-access-token"), token)) return response({ error: "Autenticação inválida." }, 401);
  let raw: string, body: AsaasWebhook;
  try { raw = await request.text(); body = JSON.parse(raw) as AsaasWebhook; }
  catch { return response({ error: "Payload inválido." }, 400); }
  const eventId = body.id?.trim(), event = body.event?.trim().toUpperCase(), paymentId = body.payment?.id?.trim();
  if (!eventId || !event || !paymentId) return response({ error: "Evento de pagamento incompleto." }, 400);
  if (!["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_REFUNDED"].includes(event)) return response({ received: true, ignored: true }, 200);
  try {
    const canonical = await getAsaasPayment(paymentId);
    if (canonical.id !== paymentId || canonical.billingType !== "PIX") return response({ error: "Pagamento não corresponde a uma cobrança Pix." }, 422);
    const payment = await authPrisma.payment.findFirst({
      where: { provider: "ASAAS", providerQrCodeId: canonical.pixQrCodeId ?? undefined },
      select: { id: true, purchaseId: true, amountCents: true, providerQrCodeId: true, purchase: { select: { totalCents: true } } },
    });
    if (!payment) return response({ error: "Vínculo do QR Code ainda não localizado." }, 503);
    if (canonical.pixQrCodeId !== payment.providerQrCodeId || (canonical.externalReference && canonical.externalReference !== "superquina_purchase_" + payment.purchaseId)
      || !Number.isFinite(canonical.value) || Math.round((canonical.value ?? 0) * 100) !== payment.amountCents
      || payment.amountCents !== payment.purchase.totalCents) return response({ error: "Pagamento não corresponde à compra registrada." }, 422);
    const digest = createHash("sha256").update(raw).digest("hex");
    const prior = await authPrisma.webhookEvent.findUnique({ where: { provider_providerEventId: { provider: "ASAAS_PAYMENT", providerEventId: eventId } }, select: { processedAt: true } });
    if (prior?.processedAt) return response({ received: true, duplicate: true }, 200);
    await authPrisma.webhookEvent.upsert({
      where: { provider_providerEventId: { provider: "ASAAS_PAYMENT", providerEventId: eventId } },
      create: { provider: "ASAAS_PAYMENT", providerEventId: eventId, eventType: event, payloadDigest: digest, paymentId: payment.id },
      update: { eventType: event, payloadDigest: digest, paymentId: payment.id, processingError: null },
    });
    await authPrisma.payment.update({ where: { id: payment.id }, data: { providerPaymentId: canonical.id, providerStatus: canonical.status ?? event, providerStatusDetail: event } });
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      if (canonical.status !== "RECEIVED") return response({ error: "Pagamento ainda não está recebido no Asaas." }, 503);
      const result = await confirmPixPayment(authPrisma, { paymentId: payment.id, providerStatus: canonical.status, providerStatusDetail: event });
      if (result.outcome === "late_or_unavailable") {
        await authPrisma.webhookEvent.updateMany({ where: { provider: "ASAAS_PAYMENT", providerEventId: eventId }, data: { processedAt: new Date(), processingError: "reconciliation_required" } });
        return response({ received: true, reconciliationRequired: true }, 200);
      }
      if (result.outcome === "not_pending") return response({ error: "Compra não está pendente para confirmação." }, 409);
    } else {
      await recordUnexpectedExternalRefund(authPrisma, { purchaseId: payment.purchaseId, paymentId: payment.id, providerStatus: canonical.status ?? event, source: "webhook" });
    }
    await authPrisma.webhookEvent.updateMany({ where: { provider: "ASAAS_PAYMENT", providerEventId: eventId }, data: { processedAt: new Date(), processingError: null } });
    return response({ received: true }, 200);
  } catch { return response({ error: "Falha ao reconciliar pagamento Asaas; o evento poderá ser reenviado." }, 503); }
}
