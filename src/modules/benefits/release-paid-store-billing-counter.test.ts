import { describe, expect, it, vi } from "vitest";
import { releasePaidStoreBillingCounter } from "./release-paid-store-billing-counter";

describe("releasePaidStoreBillingCounter", () => {
  it("decrements exactly the coupons linked to the paid billing", async () => {
    const storeUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      storeBilling: {
        findUnique: vi.fn().mockResolvedValue({
          storeId: "store-1",
          _count: { couponLinks: 37 },
        }),
      },
      store: { updateMany: storeUpdateMany },
    };

    await releasePaidStoreBillingCounter(tx as never, "billing-1");

    expect(storeUpdateMany).toHaveBeenCalledWith({
      where: { id: "store-1", outstandingCouponCount: { gte: 37 } },
      data: { outstandingCouponCount: { decrement: 37 } },
    });
  });

  it("does not write when the billing contains no coupon links", async () => {
    const storeUpdateMany = vi.fn();
    const tx = {
      storeBilling: {
        findUnique: vi.fn().mockResolvedValue({
          storeId: "store-1",
          _count: { couponLinks: 0 },
        }),
      },
      store: { updateMany: storeUpdateMany },
    };

    await releasePaidStoreBillingCounter(tx as never, "billing-empty");

    expect(storeUpdateMany).not.toHaveBeenCalled();
  });

  it("fails closed if the counter would underflow", async () => {
    const tx = {
      storeBilling: {
        findUnique: vi.fn().mockResolvedValue({
          storeId: "store-1",
          _count: { couponLinks: 37 },
        }),
      },
      store: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };

    await expect(releasePaidStoreBillingCounter(tx as never, "billing-1"))
      .rejects.toThrow("STORE_BILLING_COUNTER_INVARIANT");
  });
});
