import { describe, expect, it } from "vitest";
import { allocateNumberStake } from "./allocate-number-stake";
import { createNumericPrizeRuleSnapshot, NUMERIC_PRIZE_RULE_VERSION } from "./numeric-prize-rules";
import { getNumericPrizeReview } from "./numeric-prize-review";
function line(numberValue: string, stakeCents = 600) { return { numberValue, ...allocateNumberStake(stakeCents), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() }; }

describe("getNumericPrizeReview", () => {
  it("identifies the highest matching category among five categories", () => {
    expect(getNumericPrizeReview(line("123456"), "999956")).toMatchObject({ category: "tens", stakeCents: 120, multiplier: 20, calculatedPrizeCents: 2400, calculationConsistent: true });
    expect(getNumericPrizeReview(line("123456"), "123456")).toMatchObject({ category: "sena", multiplier: 200_000, calculationConsistent: true });
  });
  it("assigns remainder cents to Dezena only", () => {
    const wager = line("123456", 103);
    expect(wager.tensCents).toBe(23);
    expect(getNumericPrizeReview(wager, "999956")).toMatchObject({ category: "tens", stakeCents: 23, multiplier: 20, calculatedPrizeCents: 460, calculationConsistent: true });
    expect(getNumericPrizeReview(wager, "999456")).toMatchObject({ category: "hundreds", stakeCents: 20, multiplier: 200, calculatedPrizeCents: 4000, calculationConsistent: true });
  });
  it("does not classify a one-digit-only match as a prize", () => expect(getNumericPrizeReview(line("123456"), "999996")).toBeNull());
  it("rejects invalid snapshots", () => expect(getNumericPrizeReview({ ...line("123456"), ruleSnapshot: null }, "123456")?.calculationConsistent).toBe(false));
  it("rejects an invalid allocation even when another category wins", () => expect(getNumericPrizeReview({ ...line("123456"), tensCents: -1 }, "123456")?.calculationConsistent).toBe(false));
});
