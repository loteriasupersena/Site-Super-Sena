ALTER TABLE "PrizePaymentRequest"
  ADD COLUMN "pixKeyType" TEXT,
  ADD COLUMN "holderNameEncrypted" TEXT,
  ADD COLUMN "holderCpfEncrypted" TEXT,
  ADD COLUMN "holderCpfMasked" TEXT;
