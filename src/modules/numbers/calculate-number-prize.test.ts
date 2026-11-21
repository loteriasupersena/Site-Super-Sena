import { describe, expect, it } from "vitest";
import { allocateNumberStake } from "../../domain/allocate-number-stake";
import { createNumericPrizeRuleSnapshot, NUMERIC_PRIZE_RULE_VERSION, LEGACY_NUMERIC_PRIZE_RULE_VERSION, DEFAULT_NUMERIC_PRIZE_MULTIPLIERS } from "../../domain/numeric-prize-rules";
import { calculateNumberPrizeCents } from "./calculate-number-prize";
function line(numberValue: string) { return { numberValue, ...allocateNumberStake(600), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() }; }

describe("calculateNumberPrizeCents", () => {
  it("pays only Sena on an exact six-digit match", () => expect(calculateNumberPrizeCents(line("123456"), "123456")).toBe(100 * 200_000));
  it("pays only Quina on the final five digits", () => expect(calculateNumberPrizeCents(line("123456"), "923456")).toBe(100 * 20_000));
  it("pays only Milhar on the final four digits", () => expect(calculateNumberPrizeCents(line("123456"), "993456")).toBe(100 * 2_000));
  it("pays only Centena on the final three digits", () => expect(calculateNumberPrizeCents(line("123456"), "999456")).toBe(100 * 200));
  it("pays only Dezena on the final two digits", () => expect(calculateNumberPrizeCents(line("123456"), "999956")).toBe(100 * 20));
  it("pays R$6.00 for a unit match on the fixed R$6.00 game", () => {
    expect(calculateNumberPrizeCents(line("123456"), "999996")).toBe(600);
  });
  it("calculates a unit prize independently for each six-digit game in the same receipt", () => {
    const receiptGames = [
      { numberValue: "123451", ...allocateNumberStake(600), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() },
      { numberValue: "654322", ...allocateNumberStake(600), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() },
      { numberValue: "987653", ...allocateNumberStake(600), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() },
    ];
    const prizes = receiptGames.map((game) => calculateNumberPrizeCents(game, "000001"));
    expect(prizes).toEqual([600, 0, 0]);
    expect(prizes.reduce((total, prize) => total + prize, 0)).toBe(600);
  });
  it("uses the saved v3 category value for a new fixed-price game", () => {
    const wager = { ...line("123456"), ruleSnapshot: createNumericPrizeRuleSnapshot({ ...DEFAULT_NUMERIC_PRIZE_MULTIPLIERS, unit: 9 }) };
    expect(calculateNumberPrizeCents(wager, "999996")).toBe(900);
  });
  it("preserves the previous v2 unit rule for already-recorded bets", () => {
    const wager = {
      numberValue: "123456", ...allocateNumberStake(100),
      ruleVersion: "numeric-six-digit-v2",
      ruleSnapshot: { version: "numeric-six-digit-v2", multipliers: DEFAULT_NUMERIC_PRIZE_MULTIPLIERS },
    };
    expect(calculateNumberPrizeCents(wager, "999996")).toBe(100);
  });
  it("preserves legacy v1 unit calculation for existing bets", () => {
    const legacyMultipliers = { ...DEFAULT_NUMERIC_PRIZE_MULTIPLIERS, unit: 5 };
    const wager = { numberValue: "123456", ...allocateNumberStake(100), ruleVersion: LEGACY_NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: { version: LEGACY_NUMERIC_PRIZE_RULE_VERSION, multipliers: legacyMultipliers } };
    expect(calculateNumberPrizeCents(wager, "999996")).toBe(100);
  });
  it("returns zero when no suffix matches", () => expect(calculateNumberPrizeCents(line("123456"), "999994")).toBe(0));
  it("uses leading zeroes literally", () => expect(calculateNumberPrizeCents(line("000007"), "123007")).toBe(allocateNumberStake(600).hundredsCents * 200));
  it("rejects invalid snapshots and allocations", () => {
    const valid = line("123456");
    expect(() => calculateNumberPrizeCents({ ...valid, ruleSnapshot: null }, "123456")).toThrow(/snapshot/i);
    expect(() => calculateNumberPrizeCents({ ...valid, senaCents: -1 }, "123456")).toThrow(/allocation/i);
  });
});
