export type BenefitsEconomicsInput = {
  couponVolume: number;
  averagePurchaseCents: number;
  platformRateBasisPoints: number;
  batchSize: number;
  winnersPerBatch: number;
  pixPayoutFeeCents: number;
};

export type BenefitsEconomicsResult = {
  completeBatches: number;
  remainingCoupons: number;
  totalCoupons: number;
  purchaseVolumeCents: number;
  platformRevenueCents: number;
  completedBatchPrizeCents: number;
  expectedPrizeReserveCents: number;
  payoutFeesCents: number;
  estimatedBalanceCents: number;
  breakEvenRateBasisPoints: number;
  prizeWinnersInCompletedBatches: number;
};

const MAX_SAFE_CENTS = Number.MAX_SAFE_INTEGER;

export function simulateBenefitsEconomics(input: BenefitsEconomicsInput): BenefitsEconomicsResult {
  const {
    couponVolume,
    averagePurchaseCents,
    platformRateBasisPoints,
    batchSize,
    winnersPerBatch,
    pixPayoutFeeCents,
  } = input;

  if (!Number.isSafeInteger(couponVolume) || couponVolume < 1 || couponVolume > 10_000_000) {
    throw new Error("SIMULATION_VOLUME_INVALID");
  }
  if (!Number.isSafeInteger(averagePurchaseCents) || averagePurchaseCents < 1 || averagePurchaseCents > 2_147_483_647) {
    throw new Error("SIMULATION_AVERAGE_PURCHASE_INVALID");
  }
  if (!Number.isSafeInteger(platformRateBasisPoints) || platformRateBasisPoints < 0 || platformRateBasisPoints > 10_000) {
    throw new Error("SIMULATION_RATE_INVALID");
  }
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1_000_000) {
    throw new Error("SIMULATION_BATCH_SIZE_INVALID");
  }
  if (!Number.isSafeInteger(winnersPerBatch) || winnersPerBatch < 1 || winnersPerBatch > batchSize) {
    throw new Error("SIMULATION_WINNERS_INVALID");
  }
  if (!Number.isSafeInteger(pixPayoutFeeCents) || pixPayoutFeeCents < 0 || pixPayoutFeeCents > 1_000_000) {
    throw new Error("SIMULATION_PAYOUT_FEE_INVALID");
  }

  const completeBatches = Math.floor(couponVolume / batchSize);
  const remainingCoupons = couponVolume % batchSize;
  const purchaseVolumeCents = couponVolume * averagePurchaseCents;
  const platformRevenueCents = Math.round(purchaseVolumeCents * platformRateBasisPoints / 10_000);
  const prizeWinnersInCompletedBatches = completeBatches * winnersPerBatch;
  const completedBatchPrizeCents = prizeWinnersInCompletedBatches * averagePurchaseCents;
  // Expected cost is proportional, not rounded up to a whole winner per
  // partial batch. Round only the final monetary reserve up to one cent.
  const expectedWinnerNumerator = couponVolume * winnersPerBatch;
  const expectedPrizeReserveCents = Math.ceil(
    expectedWinnerNumerator * averagePurchaseCents / batchSize,
  );
  const payoutFeesCents = Math.ceil(
    expectedWinnerNumerator * pixPayoutFeeCents / batchSize,
  );
  const estimatedBalanceCents = platformRevenueCents - expectedPrizeReserveCents - payoutFeesCents;
  const breakEvenRateBasisPoints = Math.ceil(
    ((expectedPrizeReserveCents + payoutFeesCents) / purchaseVolumeCents) * 10_000,
  );

  if (![purchaseVolumeCents, platformRevenueCents, completedBatchPrizeCents, expectedPrizeReserveCents, payoutFeesCents, estimatedBalanceCents].every(Number.isSafeInteger)
    || purchaseVolumeCents > MAX_SAFE_CENTS) {
    throw new Error("SIMULATION_TOTAL_OUT_OF_RANGE");
  }

  return {
    completeBatches,
    remainingCoupons,
    totalCoupons: couponVolume,
    purchaseVolumeCents,
    platformRevenueCents,
    completedBatchPrizeCents,
    expectedPrizeReserveCents,
    payoutFeesCents,
    estimatedBalanceCents,
    breakEvenRateBasisPoints,
    prizeWinnersInCompletedBatches,
  };
}
