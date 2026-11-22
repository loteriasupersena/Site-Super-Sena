import { readNumericPrizeMultipliers, type NumericPrizeCategory } from "./numeric-prize-rules";
import { normalizeNumber } from "../modules/numbers/normalize-number";

export const NUMERIC_PRIZE_CATEGORY_LABELS: Record<NumericPrizeCategory, string> = {
  tens: "Dezena", hundreds: "Centena", milhar: "Milhar", quina: "Quina", sena: "Sena",
};
const FIELDS: Record<NumericPrizeCategory, "tensCents" | "hundredsCents" | "milharCents" | "quinaCents" | "senaCents"> = {
  tens: "tensCents", hundreds: "hundredsCents", milhar: "milharCents", quina: "quinaCents", sena: "senaCents",
};
type NumericLineForPrizeReview = {
  numberValue: string;
  tensCents: number;
  hundredsCents: number;
  milharCents: number;
  quinaCents: number;
  senaCents: number;
  ruleVersion: string;
  ruleSnapshot: unknown;
};
export function getNumericPrizeReview(line: NumericLineForPrizeReview, resultNumber: string | null) {
  if (!resultNumber) return null;
  const bet = normalizeNumber(line.numberValue), result = normalizeNumber(resultNumber);
  const category: NumericPrizeCategory | null =
    bet === result ? "sena" : bet.slice(-5) === result.slice(-5) ? "quina" :
    bet.slice(-4) === result.slice(-4) ? "milhar" : bet.slice(-3) === result.slice(-3) ? "hundreds" :
    bet.slice(-2) === result.slice(-2) ? "tens" : null;
  if (!category) return null;
  const multipliers = readNumericPrizeMultipliers(line.ruleVersion, line.ruleSnapshot);
  const stakeCents = line[FIELDS[category]];
  if (!multipliers) return { category, stakeCents, multiplier: null, calculatedPrizeCents: null, calculationConsistent: false };
  const multiplier = multipliers[category];
  const calculatedPrizeCents = stakeCents * multiplier;
  const allocations = Object.values(FIELDS).map((field) => line[field]);
  const totalStakeCents = allocations.reduce((total, amount) => total + amount, 0);
  const validAllocation = allocations.every((amount) => Number.isSafeInteger(amount) && amount >= 0) &&
    Number.isSafeInteger(totalStakeCents) && totalStakeCents >= 100 && totalStakeCents <= 2_147_483_647;
  return {
    category,
    stakeCents,
    multiplier,
    calculatedPrizeCents,
    calculationConsistent: validAllocation && Number.isSafeInteger(calculatedPrizeCents) &&
      calculatedPrizeCents >= 0 && calculatedPrizeCents <= 2_147_483_647,
  };
}
