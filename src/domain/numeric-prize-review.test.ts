import { describe, expect, it } from "vitest";
import { allocateNumberStake } from "./allocate-number-stake";
import { createNumericPrizeRuleSnapshot, NUMERIC_PRIZE_RULE_VERSION } from "./numeric-prize-rules";
import { getNumericPrizeReview } from "./numeric-prize-review";
function line(numberValue: string) { return { numberValue, ...allocateNumberStake(600), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() }; }

describe("getNumericPrizeReview", () => {
  it("identifies the highest matching category", () => {
    expect(getNumericPrizeReview(line("123456"), "999995")).toMatchObject({ category: "unit", stakeCents: 100, multiplier: 3, calculatedPrizeCents: 300, calculationConsistent: true });
  });
  it("identifies all six categories", () => {
    expect(getNumericPrizeReview(line("123456"), "999956")?.category).toBe("tens");
    expect(getNumericPrizeReview(line("123456"), "999456")?.category).toBe("hundreds");
    expect(getNumericPrizeReview(line("123456"), "993456")?.category).toBe("quadra");
    expect(getNumericPrizeReview(line("123456"), "923456")?.category).toBe("quina");
    expect(getNumericPrizeReview(line("123456"), "123456")?.category).toBe("sena");
  });
  it("returns null when there is no match or no result", () => {
    expect(getNumericPrizeReview(line("123456"), "999994")).toBeNull();
    expect(getNumericPrizeReview(line("123456"), null)).toBeNull();
  });
  it("marks invalid snapshots as inconsistent", () => expect(getNumericPrizeReview({ ...line("123456"), ruleSnapshot: null }, "999995")?.calculationConsistent).toBe(false));
});
