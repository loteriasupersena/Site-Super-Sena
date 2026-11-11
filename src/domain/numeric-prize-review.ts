import { readNumericPrizeMultipliers, type NumericPrizeCategory } from "./numeric-prize-rules";
import { normalizeNumber } from "../modules/numbers/normalize-number";

export const NUMERIC_PRIZE_CATEGORY_LABELS: Record<NumericPrizeCategory, string> = {
  unit: "Unidade", tens: "Dezena", hundreds: "Centena", quadra: "Quadra", quina: "Quina", sena: "Sena",
};
const FIELDS: Record<NumericPrizeCategory, "unitCents" | "tensCents" | "hundredsCents" | "quadraCents" | "quinaCents" | "senaCents"> = {
  unit: "unitCents", tens: "tensCents", hundreds: "hundredsCents",
  quadra: "quadraCents", quina: "quinaCents", sena: "senaCents",
};
type NumericLineForPrizeReview = {
  numberValue: string; unitCents: number; tensCents: number; hundredsCents: number;
  quadraCents: number; quinaCents: number; senaCents: number; ruleVersion: string; ruleSnapshot: unknown;
};
export function getNumericPrizeReview(line: NumericLineForPrizeReview, resultNumber: string | null) {
  if (!resultNumber) return null;
  const bet = normalizeNumber(line.numberValue), result = normalizeNumber(resultNumber);
  const category: NumericPrizeCategory | null =
    bet === result ? "sena" : bet.slice(-5) === result.slice(-5) ? "quina" :
    bet.slice(-4) === result.slice(-4) ? "quadra" : bet.slice(-3) === result.slice(-3) ? "hundreds" :
    bet.slice(-2) === result.slice(-2) ? "tens" : bet.slice(-1) === result.slice(-1) ? "unit" : null;
  if (!category) return null;
  const multipliers = readNumericPrizeMultipliers(line.ruleVersion, line.ruleSnapshot);
  if (!multipliers) return { category, stakeCents: line[FIELDS[category]], multiplier: null, calculatedPrizeCents: null, calculationConsistent: false };
  const stakeCents = line[FIELDS[category]], multiplier = multipliers[category], calculatedPrizeCents = stakeCents * multiplier;
  return { category, stakeCents, multiplier, calculatedPrizeCents,
    calculationConsistent: Number.isSafeInteger(stakeCents) && stakeCents >= 0 && Number.isSafeInteger(calculatedPrizeCents) && calculatedPrizeCents <= 2_147_483_647 };
}
