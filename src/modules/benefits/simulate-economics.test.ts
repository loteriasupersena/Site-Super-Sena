import { describe, expect, it } from "vitest";
import { simulateBenefitsEconomics } from "./simulate-economics";

describe("simulateBenefitsEconomics", () => {
  it("estimates revenue, prize reserve and balance for full 100-coupon batches", () => {
    const result = simulateBenefitsEconomics({
      couponVolume: 100,
      averagePurchaseCents: 5_000,
      platformRateBasisPoints: 200,
      batchSize: 100,
      winnersPerBatch: 1,
      pixPayoutFeeCents: 0,
    });

    expect(result.completeBatches).toBe(1);
    expect(result.remainingCoupons).toBe(0);
    expect(result.purchaseVolumeCents).toBe(500_000);
    expect(result.platformRevenueCents).toBe(10_000);
    expect(result.expectedPrizeReserveCents).toBe(5_000);
    expect(result.estimatedBalanceCents).toBe(5_000);
    expect(result.breakEvenRateBasisPoints).toBe(100);
  });

  it("reserves expected prize cost for coupons in an incomplete batch", () => {
    const result = simulateBenefitsEconomics({
      couponVolume: 150,
      averagePurchaseCents: 10_000,
      platformRateBasisPoints: 300,
      batchSize: 100,
      winnersPerBatch: 2,
      pixPayoutFeeCents: 0,
    });

    expect(result.completeBatches).toBe(1);
    expect(result.remainingCoupons).toBe(50);
    expect(result.prizeWinnersInCompletedBatches).toBe(2);
    expect(result.expectedPrizeReserveCents).toBe(30_000);
    expect(result.platformRevenueCents).toBe(45_000);
    expect(result.estimatedBalanceCents).toBe(15_000);
  });

  it("accounts for a fixed Pix payout fee per expected winner", () => {
    const result = simulateBenefitsEconomics({
      couponVolume: 100,
      averagePurchaseCents: 5_000,
      platformRateBasisPoints: 200,
      batchSize: 100,
      winnersPerBatch: 1,
      pixPayoutFeeCents: 150,
    });

    expect(result.payoutFeesCents).toBe(150);
    expect(result.estimatedBalanceCents).toBe(4_850);
  });

  it("rejects impossible winner configurations", () => {
    expect(() => simulateBenefitsEconomics({
      couponVolume: 100,
      averagePurchaseCents: 5_000,
      platformRateBasisPoints: 200,
      batchSize: 100,
      winnersPerBatch: 101,
      pixPayoutFeeCents: 0,
    })).toThrow("SIMULATION_WINNERS_INVALID");
  });
});
