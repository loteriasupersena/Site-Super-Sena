export const PRIZE_FEE_THRESHOLD_CENTS = 100_000;
export const ADMINISTRATIVE_FEE_RATE = 0.05;
export const BANK_TRANSACTION_FEE_RATE = 0.05;

export function calculatePrizeFees(grossCents: number) {
  if (!Number.isSafeInteger(grossCents) || grossCents < 0) {
    throw new Error("Invalid gross prize amount");
  }
  const appliesFees = grossCents >= PRIZE_FEE_THRESHOLD_CENTS;
  const administrativeFeeCents = appliesFees ? Math.round(grossCents * ADMINISTRATIVE_FEE_RATE) : 0;
  const transactionFeeCents = appliesFees ? Math.round(grossCents * BANK_TRANSACTION_FEE_RATE) : 0;
  return {
    grossCents,
    administrativeFeeCents,
    transactionFeeCents,
    totalFeeCents: administrativeFeeCents + transactionFeeCents,
    netCents: grossCents - administrativeFeeCents - transactionFeeCents,
  };
}

export type PrizeFeeBatchLine = {
  id: string;
  grossCents: number;
};

export function calculatePrizeFeeBatch<T extends PrizeFeeBatchLine>(lines: readonly T[]) {
  if (lines.length === 0) throw new Error("Prize fee batch cannot be empty");
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line.id || seen.has(line.id)) throw new Error("Prize fee batch contains an invalid or duplicate line");
    if (!Number.isSafeInteger(line.grossCents) || line.grossCents <= 0) {
      throw new Error("Invalid gross prize amount in batch");
    }
    seen.add(line.id);
  }

  const grossCents = lines.reduce((sum, line) => sum + line.grossCents, 0);
  if (!Number.isSafeInteger(grossCents)) throw new Error("Prize fee batch total is outside the safe integer range");

  // The threshold and both fees are applied once to the receipt aggregate.
  const aggregate = calculatePrizeFees(grossCents);
  const allocate = (totalFeeCents: number) => {
    const shares = lines.map((line, index) => {
      const exact = (totalFeeCents * line.grossCents) / grossCents;
      return { index, cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    let remaining = totalFeeCents - shares.reduce((sum, share) => sum + share.cents, 0);
    const priority = [...shares].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (let i = 0; i < remaining; i += 1) priority[i].cents += 1;
    return shares.sort((a, b) => a.index - b.index).map(share => share.cents);
  };

  const administrativeFees = allocate(aggregate.administrativeFeeCents);
  const transactionFees = allocate(aggregate.transactionFeeCents);
  const allocations = lines.map((line, index) => ({
    id: line.id,
    grossCents: line.grossCents,
    administrativeFeeCents: administrativeFees[index],
    transactionFeeCents: transactionFees[index],
    netCents: line.grossCents - administrativeFees[index] - transactionFees[index],
  }));

  return { ...aggregate, allocations };
}
