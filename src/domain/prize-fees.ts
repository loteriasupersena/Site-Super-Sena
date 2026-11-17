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
