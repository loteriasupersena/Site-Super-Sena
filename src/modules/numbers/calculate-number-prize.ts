import { readNumericPrizeMultipliers, type NumericPrizeCategory } from "../../domain/numeric-prize-rules";
import { normalizeNumber } from "./normalize-number";

export type NumericSettlementLine = {
  numberValue: string;
  tensCents: number;
  hundredsCents: number;
  milharCents: number;
  quinaCents: number;
  senaCents: number;
  ruleVersion: string;
  ruleSnapshot: unknown;
};

const ALLOCATION_FIELD: Record<NumericPrizeCategory, "tensCents" | "hundredsCents" | "milharCents" | "quinaCents" | "senaCents"> = {
  tens: "tensCents",
  hundreds: "hundredsCents",
  milhar: "milharCents",
  quina: "quinaCents",
  sena: "senaCents",
};

/** Pays only the highest matching suffix category for each six-digit bet. */
export function calculateNumberPrizeCents(line: NumericSettlementLine, drawnNumber: string): number {
  const bet = normalizeNumber(line.numberValue);
  const drawn = normalizeNumber(drawnNumber);
  const multipliers = readNumericPrizeMultipliers(line.ruleVersion, line.ruleSnapshot);
  if (!multipliers) throw new Error("Stored numeric prize rule snapshot is invalid.");
  const matches: Array<{ category: NumericPrizeCategory; matched: boolean }> = [
    { category: "sena", matched: bet === drawn },
    { category: "quina", matched: bet.slice(-5) === drawn.slice(-5) },
    { category: "milhar", matched: bet.slice(-4) === drawn.slice(-4) },
    { category: "hundreds", matched: bet.slice(-3) === drawn.slice(-3) },
    { category: "tens", matched: bet.slice(-2) === drawn.slice(-2) },
  ];
  const winningCategory = matches.find(({ matched }) => matched)?.category;
  if (!winningCategory) return 0;

  const allocations = Object.values(ALLOCATION_FIELD).map((field) => line[field]);
  if (allocations.some((amount) => !Number.isSafeInteger(amount) || amount < 0)) {
    throw new Error("Stored numeric category allocation is invalid.");
  }
  const totalStakeCents = allocations.reduce((total, amount) => total + amount, 0);
  if (!Number.isSafeInteger(totalStakeCents) || totalStakeCents < 100) {
    throw new Error("Stored numeric stake is invalid.");
  }
  const stake = line[ALLOCATION_FIELD[winningCategory]];
  const prize = stake * multipliers[winningCategory];
  if (!Number.isSafeInteger(prize) || prize > 2_147_483_647) throw new Error("Numeric prize exceeds the database integer range.");
  return prize;
}
