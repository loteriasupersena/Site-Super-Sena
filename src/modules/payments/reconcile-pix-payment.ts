import { type PrismaClient } from "@/generated/prisma/client";
import { getAsaasPayment, listAsaasPaymentsByQrCode } from "@/modules/payments/asaas";
import { confirmPixPayment } from "@/modules/payments/confirm-payment";

export type PixReconciliationOutcome =
  | "confirmed"
  | "already_confirmed"
  | "late_or_unavailable"
  | "not_pending"
  | "still_pending"
;

/**
 * Rechecks the canonical Asaas Pix payment when a webhook is delayed or missed.
 * Webhook and fallback converge on the same transactional, idempotent confirmation.
 */
export async function reconcilePixPaymentFromProvider(
  prisma: PrismaClient,
  paymentId: string,
): Promise<PixReconciliationOutcome> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      purchaseId: true,
      provider: true,
      providerPaymentId: true,
      providerQrCodeId: true,
      amountCents: true,
      status: true,
      purchase: { select: { totalCents: true, status: true } },
    },
  });
  if (!payment) return "not_pending";
  if (payment.provider === "ASAAS") {
    if (!payment.providerQrCodeId) return "not_pending";
    if (payment.status === "CONFIRMED" && payment.purchase.status === "CONFIRMED") return "already_confirmed";
    if (payment.status !== "PENDING" || payment.purchase.status !== "PENDING_PAYMENT") return "not_pending";
    const candidates = await listAsaasPaymentsByQrCode(payment.providerQrCodeId);
    const received = candidates.find((candidate) => candidate.id && candidate.status === "RECEIVED");
    if (!received?.id) return "still_pending";
    const canonical = await getAsaasPayment(received.id);
    if (canonical.id !== received.id || canonical.status !== "RECEIVED" || canonical.billingType !== "PIX"
      || canonical.pixQrCodeId !== payment.providerQrCodeId
      || (canonical.externalReference && canonical.externalReference !== "superquina_purchase_" + payment.purchaseId)
      || !Number.isFinite(canonical.value) || Math.round((canonical.value ?? 0) * 100) !== payment.amountCents
      || payment.amountCents !== payment.purchase.totalCents) throw new Error("Asaas payment does not match the pending Pix purchase");
    await prisma.payment.update({ where: { id: payment.id }, data: { providerPaymentId: canonical.id, providerStatus: canonical.status, providerStatusDetail: "received" } });
    const result = await confirmPixPayment(prisma, { paymentId: payment.id, providerStatus: canonical.status, providerStatusDetail: "received" });
    return result.outcome;
  }
  return "not_pending";
}
