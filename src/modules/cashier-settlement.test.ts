import { describe, expect, it, vi } from "vitest";
import { calculateCashierSettlement } from "./cashier-settlement";

function transactionFixture({
  cash = 50000, pix = 30000, commission = 8000, payouts = 5000,
  payoutCount = 2, pending = 0, pendingCount = 0, games = 7, sales = [
    { id: "cash-sale", totalCents: 50000, commission: { cashierId: "cashier-1", rateBasisPoints: 1000, amountCents: 5000 } },
    { id: "pix-sale", totalCents: 30000, commission: { cashierId: "cashier-1", rateBasisPoints: 1000, amountCents: 3000 } },
  ],
} = {}) {
  return {
    purchase: {
      aggregate: vi.fn()
        .mockResolvedValueOnce({ _sum: { totalCents: cash }, _count: { _all: cash ? 1 : 0 } })
        .mockResolvedValueOnce({ _sum: { totalCents: pix }, _count: { _all: pix ? 1 : 0 } })\n        .mockResolvedValueOnce({ _sum: { totalCents: pending }, _count: { _all: pendingCount } }),
      findMany: vi.fn().mockResolvedValue(sales),
    },
    cashierCommission: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountCents: commission } }) },
    numericParticipationLine: { count: vi.fn().mockResolvedValue(games) },
    numericPrizePayout: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountCents: payouts }, _count: { _all: payoutCount } }) },
  } as never;
}

describe("calculateCashierSettlement", () => {
  it("reconciles separate cash boxes and calculates the transfer due from the cashier", async () => {
    const result = await calculateCashierSettlement(
      transactionFixture(), "cashier-1", new Date("2026-11-01T00:00:00.000Z"), new Date("2026-11-13T00:00:00.000Z"),
    );
    expect(result).toMatchObject({
      cashSalesCents: 50000,
      pixSalesCents: 30000,
      totalSalesCents: 80000,
      commissionCents: 8000,
      cashPrizePayoutCents: 5000,
      netBalanceCents: 37000,
      cashierOwesPlatformCents: 37000,
      platformOwesCashierCents: 0,
    });
  });

  it("shows when the platform owes the cashier after cash prizes and commission", async () => {
    const tx = transactionFixture({
      cash: 0, pix: 10000, commission: 1000, payouts: 2000, payoutCount: 1, games: 1,
      sales: [{ id: "pix-sale", totalCents: 10000, commission: { cashierId: "cashier-1", rateBasisPoints: 1000, amountCents: 1000 } }],
    });
    const result = await calculateCashierSettlement(tx, "cashier-1", new Date(0), new Date("2026-11-13T00:00:00.000Z"));
    expect(result.netBalanceCents).toBe(-3000);
    expect(result.cashierOwesPlatformCents).toBe(0);
    expect(result.platformOwesCashierCents).toBe(3000);
  });

  it("reports cash already received but not yet allocated so the administrator can block closing", async () => {\n    const tx = transactionFixture({ pending: 12000, pendingCount: 2 });\n    const result = await calculateCashierSettlement(tx, "cashier-1", new Date(0), new Date("2026-11-13T00:00:00.000Z"));\n    expect(result.pendingCashSalesCount).toBe(2);\n    expect(result.pendingCashSalesCents).toBe(12000);\n  });\n\n  it("blocks an inconsistent commission rather than producing a misleading balance", async () => {
    const tx = transactionFixture({
      sales: [{ id: "bad-sale", totalCents: 50000, commission: { cashierId: "cashier-1", rateBasisPoints: 1000, amountCents: 4999 } }],
    });
    await expect(calculateCashierSettlement(tx, "cashier-1", new Date(0), new Date("2026-11-13T00:00:00.000Z")))
      .rejects.toThrow("CASHIER_COMMISSION_INTEGRITY_ERROR");
  });
});
