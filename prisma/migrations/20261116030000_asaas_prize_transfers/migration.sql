ALTER TYPE "PrizePaymentRequestStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PrizePaymentRequestStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "PrizePaymentRequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "PrizePaymentRequest"
  ADD COLUMN "asaasTransferId" TEXT,
  ADD COLUMN "asaasTransferStatus" TEXT,
  ADD COLUMN "asaasTransferReceiptUrl" TEXT,
  ADD COLUMN "asaasTransferFailureReason" TEXT,
  ADD COLUMN "transferRequestedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "PrizePaymentRequest_asaasTransferId_key"
  ON "PrizePaymentRequest"("asaasTransferId");
