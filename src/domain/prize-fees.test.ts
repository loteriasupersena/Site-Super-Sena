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

});

describe("calculatePrizeFeeBatch", () => {
  it("applies the threshold to the receipt total, not to each prize line", async () => {
    const { calculatePrizeFeeBatch } = await import("./prize-fees");
    const result = calculatePrizeFeeBatch([
      { id: "line-a", grossCents: 60_000 },
      { id: "line-b", grossCents: 50_000 },
    ]);
    expect(result).toMatchObject({ grossCents: 110_000, administrativeFeeCents: 5_500, transactionFeeCents: 5_500, netCents: 99_000 });
  });

  it("allocates rounded fees proportionally without losing cents", async () => {
    const { calculatePrizeFeeBatch } = await import("./prize-fees");
    const result = calculatePrizeFeeBatch([
      { id: "line-a", grossCents: 100_001 },
      { id: "line-b", grossCents: 100_003 },
      { id: "line-c", grossCents: 99_997 },
    ]);
    expect(result.allocations.reduce((sum, line) => sum + line.administrativeFeeCents, 0)).toBe(result.administrativeFeeCents);
    expect(result.allocations.reduce((sum, line) => sum + line.transactionFeeCents, 0)).toBe(result.transactionFeeCents);
    expect(result.allocations.reduce((sum, line) => sum + line.netCents, 0)).toBe(result.netCents);
  });

  it("does not charge fees when the aggregate is below the threshold", async () => {
    const { calculatePrizeFeeBatch } = await import("./prize-fees");
    const result = calculatePrizeFeeBatch([
      { id: "line-a", grossCents: 50_000 },
      { id: "line-b", grossCents: 49_999 },
    ]);
    expect(result).toMatchObject({ administrativeFeeCents: 0, transactionFeeCents: 0, netCents: 99_999 });
  });

  it("rejects empty, duplicate, and invalid batches", async () => {
    const { calculatePrizeFeeBatch } = await import("./prize-fees");
    expect(() => calculatePrizeFeeBatch([])).toThrow();
    expect(() => calculatePrizeFeeBatch([{ id: "same", grossCents: 1 }, { id: "same", grossCents: 2 }])).toThrow();
    expect(() => calculatePrizeFeeBatch([{ id: "bad", grossCents: 0 }])).toThrow();
  });
});
