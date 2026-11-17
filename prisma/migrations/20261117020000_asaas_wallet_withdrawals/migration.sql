ALTER TYPE "WithdrawalStatus" ADD VALUE IF NOT EXISTS 'FAILED';

ALTER TABLE "Withdrawal"
  ADD COLUMN "pixKeyType" TEXT,
  ADD COLUMN "holderNameEncrypted" TEXT,
  ADD COLUMN "holderCpfEncrypted" TEXT,
  ADD COLUMN "holderCpfMasked" TEXT,
  ADD COLUMN "pixKeyMasked" TEXT,
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "asaasTransferId" TEXT,
  ADD COLUMN "asaasTransferStatus" TEXT,
  ADD COLUMN "asaasTransferFailureReason" TEXT,
  ADD COLUMN "transferRequestedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Withdrawal_paymentReference_key" ON "Withdrawal"("paymentReference");
CREATE UNIQUE INDEX "Withdrawal_asaasTransferId_key" ON "Withdrawal"("asaasTransferId");
