import { describe, expect, it } from "vitest";
import { allocateNumberStake } from "../../domain/allocate-number-stake";
import { createNumericPrizeRuleSnapshot, NUMERIC_PRIZE_RULE_VERSION } from "../../domain/numeric-prize-rules";
import { calculateNumberPrizeCents } from "./calculate-number-prize";
function line(numberValue: string) { return { numberValue, ...allocateNumberStake(600), ruleVersion: NUMERIC_PRIZE_RULE_VERSION, ruleSnapshot: createNumericPrizeRuleSnapshot() }; }

describe("calculateNumberPrizeCents", () => {
  it("pays only Sena on an exact six-digit match", () => expect(calculateNumberPrizeCents(line("123456"), "123456")).toBe(100 * 300_000));
  it("pays only Quina on the final five digits", () => expect(calculateNumberPrizeCents(line("123456"), "923456")).toBe(100 * 30_000));
  it("pays only Quadra on the final four digits", () => expect(calculateNumberPrizeCents(line("123456"), "993456")).toBe(100 * 3_000));
  it("pays only Centena on the final three digits", () => expect(calculateNumberPrizeCents(line("123456"), "999456")).toBe(100 * 300));
  it("pays only Dezena on the final two digits", () => expect(calculateNumberPrizeCents(line("123456"), "999956")).toBe(100 * 30));
  it("returns exactly the R$1.00 stake when only the unit matches", () => {
    const oneRealLine = {
      numberValue: "123456",
      ...allocateNumberStake(100),
      ruleVersion: NUMERIC_PRIZE_RULE_VERSION,
      ruleSnapshot: createNumericPrizeRuleSnapshot(),
    };
    expect(oneRealLine.unitCents).toBe(20);
    expect(calculateNumberPrizeCents(oneRealLine, "999996")).toBe(100);
  });
  it("returns zero when no suffix matches", () => expect(calculateNumberPrizeCents(line("123456"), "999994")).toBe(0));
  it("uses leading zeroes literally", () => expect(calculateNumberPrizeCents(line("000007"), "123007")).toBe(allocateNumberStake(600).hundredsCents * 300));
  it("rejects invalid snapshots and allocations", () => {
    const valid = line("123456");
    expect(() => calculateNumberPrizeCents({ ...valid, ruleSnapshot: null }, "123456")).toThrow(/snapshot/i);
    expect(() => calculateNumberPrizeCents({ ...valid, senaCents: -1 }, "123456")).toThrow(/allocation/i);
  });
});
