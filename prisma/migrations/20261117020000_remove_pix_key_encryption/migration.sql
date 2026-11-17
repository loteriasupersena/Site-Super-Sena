-- Store beneficiary Pix details directly for wallet withdrawals and physical receipt payouts.
-- Existing ciphertext columns remain nullable for historical records; application code no longer reads or writes them.
ALTER TABLE "Withdrawal"
  ADD COLUMN "pixKey" TEXT,
  ADD COLUMN "holderName" TEXT,
  ALTER COLUMN "pixKeyEncrypted" DROP NOT NULL;

ALTER TABLE "PrizePaymentBatch"
  ADD COLUMN "pixKey" TEXT,
  ADD COLUMN "holderName" TEXT,
  ALTER COLUMN "pixKeyEncrypted" DROP NOT NULL,
  ALTER COLUMN "holderNameEncrypted" DROP NOT NULL,
  ALTER COLUMN "holderCpfEncrypted" DROP NOT NULL;
