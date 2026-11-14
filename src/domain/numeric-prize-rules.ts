export const NUMERIC_PRIZE_CATEGORIES = ["unit", "tens", "hundreds", "quadra", "quina", "sena"] as const;

export type NumericPrizeCategory = (typeof NUMERIC_PRIZE_CATEGORIES)[number];
export type NumericPrizeMultipliers = Record<NumericPrizeCategory, number>;

export const NUMERIC_PRIZE_RULE_VERSION = "numeric-six-digit-v1";

export const DEFAULT_NUMERIC_PRIZE_MULTIPLIERS: NumericPrizeMultipliers = {
  unit: 5, tens: 30, hundreds: 300, quadra: 3_000, quina: 30_000, sena: 300_000,
};

export const APPROVED_NUMERIC_PRIZE_MULTIPLIERS = DEFAULT_NUMERIC_PRIZE_MULTIPLIERS;

export function parseNumericPrizeMultipliers(value: unknown): NumericPrizeMultipliers | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const parsed = {} as NumericPrizeMultipliers;
  for (const category of NUMERIC_PRIZE_CATEGORIES) {
    const multiplier = raw[category];
    if (!Number.isSafeInteger(multiplier) || (multiplier as number) < 0 || (multiplier as number) > 1_000_000) return null;
    parsed[category] = multiplier as number;
  }
  return parsed;
}

export function createNumericPrizeRuleSnapshot(multipliers: NumericPrizeMultipliers = DEFAULT_NUMERIC_PRIZE_MULTIPLIERS) {
  return { version: NUMERIC_PRIZE_RULE_VERSION, multipliers: { ...multipliers } };
}

export function readNumericPrizeMultipliers(ruleVersion: string, snapshot: unknown): NumericPrizeMultipliers | null {
  if (ruleVersion !== NUMERIC_PRIZE_RULE_VERSION || snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const value = snapshot as Record<string, unknown>;
  if (value.version !== ruleVersion) return null;
  return parseNumericPrizeMultipliers(value.multipliers);
}
