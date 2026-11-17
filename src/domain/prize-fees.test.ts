import { describe, expect, it } from "vitest";
import { calculatePrizeFees, PRIZE_FEE_THRESHOLD_CENTS } from "./prize-fees";

describe("calculatePrizeFees", () => {
  it("does not charge prizes below R$ 1,000.00", () => {
    expect(calculatePrizeFees(PRIZE_FEE_THRESHOLD_CENTS - 1)).toMatchObject({
      administrativeFeeCents: 0, transactionFeeCents: 0, netCents: 99_999,
    });
  });

  it("charges 5% administrative and 5% bank transaction fees from R$ 1,000.00", () => {
    expect(calculatePrizeFees(PRIZE_FEE_THRESHOLD_CENTS)).toMatchObject({
      grossCents: 100_000, administrativeFeeCents: 5_000,
      transactionFeeCents: 5_000, totalFeeCents: 10_000, netCents: 90_000,
    });
  });

  it("applies the same 10% total deduction to wallet and physical prize calculations", () => {
    expect(calculatePrizeFees(250_000).netCents).toBe(225_000);
  });
});
