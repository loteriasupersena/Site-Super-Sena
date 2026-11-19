import { type PrismaClient } from "@/generated/prisma/client";
import { classifyPixOrderStatus, getVerifiedPixOrder } from "@/modules/payments/mercado-pago";
import { confirmPixPayment } from "@/modules/payments/confirm-payment";

export type PixReconciliationOutcome =
  | "confirmed"
  | "already_confirmed"
  | "late_or_unavailable"
  | "not_pending"
  | "still_pending"
  | "terminal";

/**
 * Rechecks the canonical Mercado Pago order. Browser status checks, webhook,
 * and the independent scheduler converge on confirmPixPayment, which is
 * transactional and idempotent.
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
      amountCents: true,
      status: true,
      purchase: { select: { totalCents: true, status: true } },
    },
  });
  if (!payment || payment.provider !== "MERCADO_PAGO" || !payment.providerPaymentId) return "not_pending";
  if (payment.status === "CONFIRMED" && payment.purchase.status === "CONFIRMED") return "already_confirmed";
  if (payment.status !== "PENDING" || payment.purchase.status !== "PENDING_PAYMENT") return "not_pending";

  const canonical = await getVerifiedPixOrder(payment.providerPaymentId);
  const { providerStatus, normalizedStatus, approved } = classifyPixOrderStatus(canonical);
  const methodMismatch = (canonical.paymentMethodId !== null && canonical.paymentMethodId.toLowerCase() !== "pix")
    || (canonical.paymentMethodType !== null && canonical.paymentMethodType.toLowerCase() !== "bank_transfer");
  if (canonical.orderId !== payment.providerPaymentId
    || canonical.externalReference !== "superquina_purchase_" + payment.purchaseId
    || canonical.currency !== "BRL"
    || canonical.amountCents !== payment.amountCents
    || payment.amountCents !== payment.purchase.totalCents
    || methodMismatch
    || (approved && (canonical.paymentAmountCents !== payment.amountCents
      || canonical.paymentMethodId?.toLowerCase() !== "pix"
      || canonical.paymentMethodType?.toLowerCase() !== "bank_transfer"))) {
    throw new Error("Mercado Pago order does not match the pending Pix purchase");
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerStatus, providerStatusDetail: canonical.statusDetail },
  });

  if (approved) {
    const result = await confirmPixPayment(prisma, {
      paymentId: payment.id,
      providerStatus,
      providerStatusDetail: canonical.statusDetail,
    });
    return result.outcome;
  }

  if (normalizedStatus === "refunded") {
    const { recordUnexpectedExternalRefund } = await import("@/modules/payments/record-unexpected-refund");
    await recordUnexpectedExternalRefund(prisma, {
      purchaseId: payment.purchaseId, paymentId: payment.id, providerStatus, source: "reconciliation",
    });
    return "terminal";
  }

  const terminalStatus = ["rejected", "failure", "failed"].includes(normalizedStatus)
    ? "FAILED"
    : ["cancelled", "canceled"].includes(normalizedStatus)
      ? "CANCELLED"
      : normalizedStatus === "expired" ? "EXPIRED" : null;
  if (terminalStatus) {
    const { cancelPendingPixPurchase } = await import("@/modules/payments/cancel-pending-pix-purchase");
    await cancelPendingPixPurchase(prisma, {
      paymentId: payment.id, purchaseId: payment.purchaseId, terminalStatus,
      providerStatus, providerStatusDetail: canonical.statusDetail, source: "reconciliation",
    });
    return "terminal";
  }

  return "still_pending";
}
