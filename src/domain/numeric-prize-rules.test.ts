import { describe, expect, it } from "vitest";
import { APPROVED_NUMERIC_PRIZE_MULTIPLIERS, createNumericPrizeRuleSnapshot, NUMERIC_PRIZE_RULE_VERSION, readNumericPrizeMultipliers } from "./numeric-prize-rules";
describe("numeric prize rules", () => {
  it("defines six approved categories and multipliers", () => expect(APPROVED_NUMERIC_PRIZE_MULTIPLIERS).toEqual({ unit: 6, tens: 30, hundreds: 300, quadra: 3_000, quina: 30_000, sena: 300_000 }));
  it("creates and reads a versioned snapshot", () => { const snapshot = createNumericPrizeRuleSnapshot(); expect(snapshot.version).toBe(NUMERIC_PRIZE_RULE_VERSION); expect(readNumericPrizeMultipliers(snapshot.version, snapshot)).toEqual(snapshot.multipliers); });
  it("rejects missing, mismatched, or malformed snapshots", () => { const valid = createNumericPrizeRuleSnapshot(); expect(readNumericPrizeMultipliers("other", valid)).toBeNull(); expect(readNumericPrizeMultipliers(valid.version, null)).toBeNull(); expect(readNumericPrizeMultipliers(valid.version, { version: valid.version, multipliers: { ...valid.multipliers, sena: -1 } })).toBeNull(); });
});
