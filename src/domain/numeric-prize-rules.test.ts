import { describe, expect, it } from "vitest";
import { APPROVED_NUMERIC_PRIZE_MULTIPLIERS, createNumericPrizeRuleSnapshot, NUMERIC_PRIZE_RULE_VERSION, readNumericPrizeMultipliers, LEGACY_NUMERIC_PRIZE_RULE_VERSION } from "./numeric-prize-rules";
describe("numeric prize rules", () => {
  it("defines six approved categories and multipliers", () => expect(APPROVED_NUMERIC_PRIZE_MULTIPLIERS).toEqual({ unit: 6, tens: 20, hundreds: 200, milhar: 2_000, quina: 20_000, sena: 200_000 }));
  it("creates and reads a versioned v2 snapshot", () => { const snapshot = createNumericPrizeRuleSnapshot(); expect(snapshot.version).toBe(NUMERIC_PRIZE_RULE_VERSION); expect(readNumericPrizeMultipliers(snapshot.version, snapshot)).toEqual(snapshot.multipliers); });
  it("continues to read legacy v1 snapshots", () => { const snapshot = { version: LEGACY_NUMERIC_PRIZE_RULE_VERSION, multipliers: APPROVED_NUMERIC_PRIZE_MULTIPLIERS }; expect(readNumericPrizeMultipliers(LEGACY_NUMERIC_PRIZE_RULE_VERSION, snapshot)).toEqual(snapshot.multipliers); });
  it("rejects missing, mismatched, or malformed snapshots", () => { const valid = createNumericPrizeRuleSnapshot(); expect(readNumericPrizeMultipliers("other", valid)).toBeNull(); expect(readNumericPrizeMultipliers(valid.version, null)).toBeNull(); expect(readNumericPrizeMultipliers(valid.version, { version: valid.version, multipliers: { ...valid.multipliers, sena: -1 } })).toBeNull(); });
});
