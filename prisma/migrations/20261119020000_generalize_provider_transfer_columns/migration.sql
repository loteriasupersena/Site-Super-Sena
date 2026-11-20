-- Generalize transfer metadata without discarding historical provider data.
-- Renaming preserves existing transfer IDs, statuses, receipts and failure details.

ALTER INDEX "Withdrawal_asaasTransferId_key" RENAME TO "Withdrawal_providerTransferId_key";
ALTER TABLE "Withdrawal"
  RENAME COLUMN "asaasTransferId" TO "providerTransferId";
ALTER TABLE "Withdrawal"
  RENAME COLUMN "asaasTransferStatus" TO "providerTransferStatus";
ALTER TABLE "Withdrawal"
  RENAME COLUMN "asaasTransferFailureReason" TO "providerTransferFailureReason";

ALTER INDEX "PrizePaymentRequest_asaasTransferId_key" RENAME TO "PrizePaymentRequest_providerTransferId_key";
ALTER TABLE "PrizePaymentRequest"
  RENAME COLUMN "asaasTransferId" TO "providerTransferId";
ALTER TABLE "PrizePaymentRequest"
  RENAME COLUMN "asaasTransferStatus" TO "providerTransferStatus";
ALTER TABLE "PrizePaymentRequest"
  RENAME COLUMN "asaasTransferReceiptUrl" TO "providerTransferReceiptUrl";
ALTER TABLE "PrizePaymentRequest"
  RENAME COLUMN "asaasTransferFailureReason" TO "providerTransferFailureReason";

ALTER INDEX "PrizePaymentBatch_asaasTransferId_key" RENAME TO "PrizePaymentBatch_providerTransferId_key";
ALTER TABLE "PrizePaymentBatch"
  RENAME COLUMN "asaasTransferId" TO "providerTransferId";
ALTER TABLE "PrizePaymentBatch"
  RENAME COLUMN "asaasTransferStatus" TO "providerTransferStatus";
ALTER TABLE "PrizePaymentBatch"
  RENAME COLUMN "asaasTransferReceiptUrl" TO "providerTransferReceiptUrl";
ALTER TABLE "PrizePaymentBatch"
  RENAME COLUMN "asaasTransferFailureReason" TO "providerTransferFailureReason";
