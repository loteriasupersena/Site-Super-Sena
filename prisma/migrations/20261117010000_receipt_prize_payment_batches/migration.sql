-- Aggregate prize withdrawals by receipt while preserving one payout item per winning line.
ALTER TABLE "PrizePaymentRequest" ADD COLUMN "batchId" TEXT;

CREATE TABLE "PrizePaymentBatch" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "pixKeyEncrypted" TEXT NOT NULL,
  "pixKeyMasked" TEXT NOT NULL,
  "pixKeyType" TEXT NOT NULL,
  "holderNameEncrypted" TEXT NOT NULL,
  "holderCpfEncrypted" TEXT NOT NULL,
  "holderCpfMasked" TEXT NOT NULL,
  "grossCents" INTEGER NOT NULL,
  "administrativeFeeCents" INTEGER NOT NULL DEFAULT 0,
  "transactionFeeCents" INTEGER NOT NULL DEFAULT 0,
  "netCents" INTEGER NOT NULL,
  "feeRuleVersion" TEXT NOT NULL,
  "status" "PrizePaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "paymentReference" TEXT,
  "asaasTransferId" TEXT,
  "asaasTransferStatus" TEXT,
  "asaasTransferReceiptUrl" TEXT,
  "asaasTransferFailureReason" TEXT,
  "transferRequestedAt" TIMESTAMP(3),
  CONSTRAINT "PrizePaymentBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrizePaymentBatchItem" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "participationLineId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  CONSTRAINT "PrizePaymentBatchItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrizePaymentBatch_paymentReference_key" ON "PrizePaymentBatch"("paymentReference");
CREATE UNIQUE INDEX "PrizePaymentBatch_asaasTransferId_key" ON "PrizePaymentBatch"("asaasTransferId");
CREATE INDEX "PrizePaymentBatch_purchaseId_requestedAt_idx" ON "PrizePaymentBatch"("purchaseId", "requestedAt");
CREATE INDEX "PrizePaymentBatch_status_requestedAt_idx" ON "PrizePaymentBatch"("status", "requestedAt");
CREATE UNIQUE INDEX "PrizePaymentBatchItem_batchId_participationLineId_key" ON "PrizePaymentBatchItem"("batchId", "participationLineId");
CREATE UNIQUE INDEX "PrizePaymentBatchItem_participationLineId_key" ON "PrizePaymentBatchItem"("participationLineId");
CREATE INDEX "PrizePaymentBatchItem_batchId_idx" ON "PrizePaymentBatchItem"("batchId");
CREATE INDEX "PrizePaymentRequest_batchId_status_idx" ON "PrizePaymentRequest"("batchId", "status");

ALTER TABLE "PrizePaymentBatch" ADD CONSTRAINT "PrizePaymentBatch_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrizePaymentBatch" ADD CONSTRAINT "PrizePaymentBatch_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrizePaymentBatchItem" ADD CONSTRAINT "PrizePaymentBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PrizePaymentBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrizePaymentBatchItem" ADD CONSTRAINT "PrizePaymentBatchItem_participationLineId_fkey" FOREIGN KEY ("participationLineId") REFERENCES "NumericParticipationLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrizePaymentRequest" ADD CONSTRAINT "PrizePaymentRequest_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PrizePaymentBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
