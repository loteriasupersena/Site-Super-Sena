import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Releases the exact number of coupon slots attached to a billing that has
 * just transitioned to PAID. Call only inside the same transaction as that
 * status transition, and only when the conditional update changed one row.
 */
export async function releasePaidStoreBillingCounter(
  tx: Prisma.TransactionClient,
  billingId: string,
) {
  const billing = await tx.storeBilling.findUnique({
    where: { id: billingId },
    select: {
      storeId: true,
      _count: { select: { couponLinks: true } },
    },
  });
  if (!billing) throw new Error("STORE_BILLING_NOT_FOUND");

  const couponCount = billing._count.couponLinks;
  if (couponCount === 0) return;

  const released = await tx.store.updateMany({
    where: {
      id: billing.storeId,
      outstandingCouponCount: { gte: couponCount },
    },
    data: { outstandingCouponCount: { decrement: couponCount } },
  });
  if (released.count !== 1) throw new Error("STORE_BILLING_COUNTER_INVARIANT");
}
