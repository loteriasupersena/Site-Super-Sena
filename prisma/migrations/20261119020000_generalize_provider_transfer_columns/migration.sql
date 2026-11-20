-- The platform is still in pre-production. Do not carry legacy Asaas transfer data
-- into the Mercado Pago/manual-payout flow. Keep only provider-neutral empty columns
-- required by the current application.
DROP INDEX IF EXISTS "Withdrawal_asaasTransferId_key";
ALTER TABLE "Withdrawal" DROP COLUMN IF EXISTS "asaasTransferId";
ALTER TABLE "Withdrawal" DROP COLUMN IF EXISTS "asaasTransferStatus";
ALTER TABLE "Withdrawal" DROP COLUMN IF EXISTS "asaasTransferFailureReason";
ALTER TABLE "Withdrawal" ADD COLUMN "providerTransferId" TEXT;
ALTER TABLE "Withdrawal" ADD COLUMN "providerTransferStatus" TEXT;
ALTER TABLE "Withdrawal" ADD COLUMN "providerTransferFailureReason" TEXT;
CREATE UNIQUE INDEX "Withdrawal_providerTransferId_key" ON "Withdrawal"("providerTransferId");

DROP INDEX IF EXISTS "PrizePaymentRequest_asaasTransferId_key";
ALTER TABLE "PrizePaymentRequest" DROP COLUMN IF EXISTS "asaasTransferId";
ALTER TABLE "PrizePaymentRequest" DROP COLUMN IF EXISTS "asaasTransferStatus";
ALTER TABLE "PrizePaymentRequest" DROP COLUMN IF EXISTS "asaasTransferReceiptUrl";
ALTER TABLE "PrizePaymentRequest" DROP COLUMN IF EXISTS "asaasTransferFailureReason";
ALTER TABLE "PrizePaymentRequest" ADD COLUMN "providerTransferId" TEXT;
ALTER TABLE "PrizePaymentRequest" ADD COLUMN "providerTransferStatus" TEXT;
ALTER TABLE "PrizePaymentRequest" ADD COLUMN "providerTransferReceiptUrl" TEXT;
ALTER TABLE "PrizePaymentRequest" ADD COLUMN "providerTransferFailureReason" TEXT;
CREATE UNIQUE INDEX "PrizePaymentRequest_providerTransferId_key" ON "PrizePaymentRequest"("providerTransferId");

DROP INDEX IF EXISTS "PrizePaymentBatch_asaasTransferId_key";
ALTER TABLE "PrizePaymentBatch" DROP COLUMN IF EXISTS "asaasTransferId";
ALTER TABLE "PrizePaymentBatch" DROP COLUMN IF EXISTS "asaasTransferStatus";
ALTER TABLE "PrizePaymentBatch" DROP COLUMN IF EXISTS "asaasTransferReceiptUrl";
ALTER TABLE "PrizePaymentBatch" DROP COLUMN IF EXISTS "asaasTransferFailureReason";
ALTER TABLE "PrizePaymentBatch" ADD COLUMN "providerTransferId" TEXT;
ALTER TABLE "PrizePaymentBatch" ADD COLUMN "providerTransferStatus" TEXT;
ALTER TABLE "PrizePaymentBatch" ADD COLUMN "providerTransferReceiptUrl" TEXT;
ALTER TABLE "PrizePaymentBatch" ADD COLUMN "providerTransferFailureReason" TEXT;
CREATE UNIQUE INDEX "PrizePaymentBatch_providerTransferId_key" ON "PrizePaymentBatch"("providerTransferId");
