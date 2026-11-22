import { describe, expect, it } from "vitest";
import { APPROVED_NUMERIC_PRIZE_MULTIPLIERS, createNumericPrizeRuleSnapshot, NUMERIC_PRIZE_RULE_VERSION, readNumericPrizeMultipliers } from "./numeric-prize-rules";
describe("numeric prize rules", () => {
  it("defines five approved categories and multipliers", () => expect(APPROVED_NUMERIC_PRIZE_MULTIPLIERS).toEqual({ tens: 20, hundreds: 200, milhar: 2_000, quina: 20_000, sena: 200_000 }));
  it("creates and reads a versioned five-category snapshot", () => { const snapshot = createNumericPrizeRuleSnapshot(); expect(snapshot.version).toBe(NUMERIC_PRIZE_RULE_VERSION); expect(readNumericPrizeMultipliers(snapshot.version, snapshot)).toEqual(snapshot.multipliers); });
  it("rejects legacy, missing, mismatched, or malformed snapshots", () => { const valid = createNumericPrizeRuleSnapshot(); expect(readNumericPrizeMultipliers("numeric-six-digit-v2", { version: "numeric-six-digit-v2", multipliers: { ...valid.multipliers, unit: 6 } })).toBeNull(); expect(readNumericPrizeMultipliers("other", valid)).toBeNull(); expect(readNumericPrizeMultipliers(valid.version, null)).toBeNull(); expect(readNumericPrizeMultipliers(valid.version, { version: valid.version, multipliers: { ...valid.multipliers, sena: -1 } })).toBeNull(); });
});
