import { describe, expect, it } from "vitest";
import { allocateNumberStake } from "./allocate-number-stake";
import { createNumericPrizeRuleSnapshot, NUMERIC_PRIZE_RULE_VERSION } from "./numeric-prize-rules";
import { getNumericPrizeReview } from "./numeric-prize-review";
function line(numberValue: string) { return { numberValue, ...allocateNumberStake(600), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() }; }

describe("getNumericPrizeReview", () => {
  it("identifies the highest matching category", () => {
    expect(getNumericPrizeReview(line("123456"), "999996")).toMatchObject({ category: "unit", stakeCents: 100, multiplier: 6, calculatedPrizeCents: 600, calculationConsistent: true });
  });
  it("returns the full wager for v2 unit prizes, not six times the unit allocation", () => {
    const oneReal = { numberValue: "506414", ...allocateNumberStake(100), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() };
    expect(oneReal.unitCents).toBe(20);
    expect(getNumericPrizeReview(oneReal, "096034")).toMatchObject({
      category: "unit", stakeCents: 20, multiplier: 6, calculatedPrizeCents: 100, calculationConsistent: true,
    });
  });
  it("reviews a unit hit per six-digit game, not against the receipt total", () => {
    const receiptGames = [
      { numberValue: "123451", ...allocateNumberStake(100), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() },
      { numberValue: "654322", ...allocateNumberStake(100), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() },
      { numberValue: "987653", ...allocateNumberStake(100), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() },
    ];
    const reviews = receiptGames.map((game) => getNumericPrizeReview(game, "000001"));
    expect(reviews.map((review) => review?.calculatedPrizeCents ?? 0)).toEqual([100, 0, 0]);
    expect(reviews.reduce((total, review) => total + (review?.calculatedPrizeCents ?? 0), 0)).toBe(100);
  });
  it("identifies all six categories", () => {
    expect(getNumericPrizeReview(line("123456"), "999956")?.category).toBe("tens");
    expect(getNumericPrizeReview(line("123456"), "999456")?.category).toBe("hundreds");
    expect(getNumericPrizeReview(line("123456"), "993456")?.category).toBe("milhar");
    expect(getNumericPrizeReview(line("123456"), "923456")?.category).toBe("quina");
    expect(getNumericPrizeReview(line("123456"), "123456")?.category).toBe("sena");
  });
  it("returns null when there is no match or no result", () => {
    expect(getNumericPrizeReview(line("123456"), "999994")).toBeNull();
    expect(getNumericPrizeReview(line("123456"), null)).toBeNull();
  });
  it("marks invalid snapshots as inconsistent", () => expect(getNumericPrizeReview({ ...line("123456"), ruleSnapshot: null }, "999996")?.calculationConsistent).toBe(false));
});
