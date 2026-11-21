import { readNumericPrizeMultipliers, type NumericPrizeCategory } from "./numeric-prize-rules";
import { normalizeNumber } from "../modules/numbers/normalize-number";

export const NUMERIC_PRIZE_CATEGORY_LABELS: Record<NumericPrizeCategory, string> = {
  unit: "Unidade", tens: "Dezena", hundreds: "Centena", milhar: "Milhar", quina: "Quina", sena: "Sena",
};
const FIELDS: Record<NumericPrizeCategory, "unitCents" | "tensCents" | "hundredsCents" | "milharCents" | "quinaCents" | "senaCents"> = {
  unit: "unitCents", tens: "tensCents", hundreds: "hundredsCents",
  milhar: "milharCents", quina: "quinaCents", sena: "senaCents",
};
type NumericLineForPrizeReview = {
  numberValue: string; unitCents: number; tensCents: number; hundredsCents: number;
  milharCents: number; quinaCents: number; senaCents: number; ruleVersion: string; ruleSnapshot: unknown;
};
export function getNumericPrizeReview(line: NumericLineForPrizeReview, resultNumber: string | null) {
  if (!resultNumber) return null;
  const bet = normalizeNumber(line.numberValue), result = normalizeNumber(resultNumber);
  const category: NumericPrizeCategory | null =
    bet === result ? "sena" : bet.slice(-5) === result.slice(-5) ? "quina" :
    bet.slice(-4) === result.slice(-4) ? "milhar" : bet.slice(-3) === result.slice(-3) ? "hundreds" :
    bet.slice(-2) === result.slice(-2) ? "tens" : bet.slice(-1) === result.slice(-1) ? "unit" : null;
  if (!category) return null;
  const multipliers = readNumericPrizeMultipliers(line.ruleVersion, line.ruleSnapshot);
  if (!multipliers) return { category, stakeCents: line[FIELDS[category]], multiplier: null, calculatedPrizeCents: null, calculationConsistent: false };
  const categoryAllocationCents = line[FIELDS[category]];
  const isFullStakeUnit = category === "unit" && line.ruleVersion !== "numeric-six-digit-v1";
  if (isFullStakeUnit) {
    const allocations = (["unitCents", "tensCents", "hundredsCents", "milharCents", "quinaCents", "senaCents"] as const)
      .map((field) => line[field]);
    const validAllocations = allocations.every((amount) => Number.isSafeInteger(amount) && amount >= 0);
    const totalStakeCents = allocations.reduce((total, amount) => total + amount, 0);
    // Unidade devolve a aposta inteira. Sua parcela contábil e o multiplicador legado não entram no cálculo.
    return {
      category,
      stakeCents: totalStakeCents,
      multiplier: null,
      calculatedPrizeCents: totalStakeCents,
      calculationConsistent: validAllocations && Number.isSafeInteger(totalStakeCents)
        && totalStakeCents > 0 && totalStakeCents <= 2_147_483_647,
    };
  }

  const multiplier = multipliers[category];
  const calculatedPrizeCents = categoryAllocationCents * multiplier;
  return { category, stakeCents: categoryAllocationCents, multiplier, calculatedPrizeCents,
    calculationConsistent: Number.isSafeInteger(categoryAllocationCents) && categoryAllocationCents >= 0 && Number.isSafeInteger(calculatedPrizeCents) && calculatedPrizeCents >= 0 && calculatedPrizeCents <= 2_147_483_647 };
}
