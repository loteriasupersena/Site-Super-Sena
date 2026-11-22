export type NumberStakeAllocation = {
  tensCents: number;
  hundredsCents: number;
  milharCents: number;
  quinaCents: number;
  senaCents: number;
};

/** Splits the stake across five prize categories; every remainder cent goes to Dezena. */
export function allocateNumberStake(totalCents: number): NumberStakeAllocation {
  if (!Number.isSafeInteger(totalCents) || totalCents < 100) throw new Error("Number stake must be a safe integer of at least 100 cents");
  const baseCents = Math.floor(totalCents / 5);
  const remainderCents = totalCents % 5;
  return {
    tensCents: baseCents + remainderCents,
    hundredsCents: baseCents,
    milharCents: baseCents,
    quinaCents: baseCents,
    senaCents: baseCents,
  };
}
