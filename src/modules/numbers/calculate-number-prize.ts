import { PREVIOUS_NUMERIC_PRIZE_RULE_VERSION, readNumericPrizeMultipliers, type NumericPrizeCategory } from "../../domain/numeric-prize-rules";
import { normalizeNumber } from "./normalize-number";

export type NumericSettlementLine = {
  numberValue: string;
  unitCents: number; tensCents: number; hundredsCents: number;
  milharCents: number; quinaCents: number; senaCents: number;
  ruleVersion: string; ruleSnapshot: unknown;
};

const ALLOCATION_FIELDS = [
  "unitCents", "tensCents", "hundredsCents", "milharCents", "quinaCents", "senaCents",
] as const;

const ALLOCATION_FIELD: Record<NumericPrizeCategory, typeof ALLOCATION_FIELDS[number]> = {
  unit: "unitCents", tens: "tensCents", hundreds: "hundredsCents",
  milhar: "milharCents", quina: "quinaCents", sena: "senaCents",
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
    { category: "unit", matched: bet.slice(-1) === drawn.slice(-1) },
  ];
  const winningCategory = matches.find(({ matched }) => matched)?.category;
  if (!winningCategory) return 0;

  const stake = line[ALLOCATION_FIELD[winningCategory]];
  if (!Number.isSafeInteger(stake) || stake < 0) throw new Error("Stored numeric category allocation is invalid.");

  let prize: number;
  if (winningCategory === "unit" && line.ruleVersion === PREVIOUS_NUMERIC_PRIZE_RULE_VERSION) {
    const totalStakeCents = ALLOCATION_FIELDS.reduce((total, field) => {
      const amount = line[field];
      if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Stored numeric category allocation is invalid.");
      return total + amount;
    }, 0);
    if (!Number.isSafeInteger(totalStakeCents)) throw new Error("Stored numeric stake is invalid.");
    // Preserve the previous v2 rule for already-recorded bets.
    prize = totalStakeCents;
  } else {
    // v3 assigns exactly R$1.00 to each category for a fixed R$6.00 game.
    prize = stake * multipliers[winningCategory];
  }

  if (!Number.isSafeInteger(prize) || prize > 2_147_483_647) throw new Error("Numeric prize exceeds the database integer range.");
  return prize;
}
