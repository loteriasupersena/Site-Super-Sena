import { describe, expect, it } from "vitest";
import { allocateNumberStake } from "../../domain/allocate-number-stake";
import { createNumericPrizeRuleSnapshot, NUMERIC_PRIZE_RULE_VERSION } from "../../domain/numeric-prize-rules";
import { calculateNumberPrizeCents } from "./calculate-number-prize";
function line(numberValue: string, stakeCents = 600) { return { numberValue, ...allocateNumberStake(stakeCents), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() }; }

describe("calculateNumberPrizeCents", () => {
  it("pays only Sena on an exact six-digit match", () => expect(calculateNumberPrizeCents(line("123456"), "123456")).toBe(120 * 200_000));
  it("pays only Quina on the final five digits", () => expect(calculateNumberPrizeCents(line("123456"), "923456")).toBe(120 * 20_000));
  it("pays only Milhar on the final four digits", () => expect(calculateNumberPrizeCents(line("123456"), "993456")).toBe(120 * 2_000));
  it("pays only Centena on the final three digits", () => expect(calculateNumberPrizeCents(line("123456"), "999456")).toBe(120 * 200));
  it("pays only Dezena on the final two digits", () => expect(calculateNumberPrizeCents(line("123456"), "999956")).toBe(120 * 20));
  it("does not pay a one-digit-only match", () => expect(calculateNumberPrizeCents(line("123456"), "999996")).toBe(0));
  it("uses the Dezena remainder only for the Dezena prize", () => {
    const wager = line("123456", 103);
    expect(wager.tensCents).toBe(23);
    expect(calculateNumberPrizeCents(wager, "999956")).toBe(460);
    expect(calculateNumberPrizeCents(wager, "999456")).toBe(4_000);
  });
  it("returns zero when no suffix matches", () => expect(calculateNumberPrizeCents(line("123456"), "999994")).toBe(0));
  it("uses leading zeroes literally", () => expect(calculateNumberPrizeCents(line("000007"), "123007")).toBe(120 * 200));
  it("rejects invalid snapshots and allocations", () => {
    const valid = line("123456");
    expect(() => calculateNumberPrizeCents({ ...valid, ruleSnapshot: null }, "123456")).toThrow(/snapshot/i);
    expect(() => calculateNumberPrizeCents({ ...valid, senaCents: -1 }, "123456")).toThrow(/allocation/i);
  });
});
