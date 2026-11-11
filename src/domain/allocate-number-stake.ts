export type NumberStakeAllocation = {
  unitCents: number; tensCents: number; hundredsCents: number;
  quadraCents: number; quinaCents: number; senaCents: number;
};

/** Splits the stake equally across six prize categories; remainder goes to unit. */
export function allocateNumberStake(totalCents: number): NumberStakeAllocation {
  if (!Number.isSafeInteger(totalCents) || totalCents < 100) throw new Error("Number stake must be a safe integer of at least 100 cents");
  const baseCents = Math.floor(totalCents / 6);
  const remainderCents = totalCents % 6;
  return {
    unitCents: baseCents + remainderCents, tensCents: baseCents, hundredsCents: baseCents,
    quadraCents: baseCents, quinaCents: baseCents, senaCents: baseCents,
  };
}
