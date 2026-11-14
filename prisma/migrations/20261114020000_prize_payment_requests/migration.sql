CREATE TYPE "PrizePaymentRequestStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED');

CREATE TABLE "PrizePaymentRequest" (
  "id" TEXT NOT NULL,
  "participationLineId" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "pixKeyEncrypted" TEXT NOT NULL,
  "pixKeyMasked" TEXT NOT NULL,
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
  "note" TEXT,
  CONSTRAINT "PrizePaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrizePaymentRequest_participationLineId_key" ON "PrizePaymentRequest"("participationLineId");
CREATE INDEX "PrizePaymentRequest_status_requestedAt_idx" ON "PrizePaymentRequest"("status", "requestedAt");
CREATE INDEX "PrizePaymentRequest_purchaseId_requestedAt_idx" ON "PrizePaymentRequest"("purchaseId", "requestedAt");
CREATE INDEX "PrizePaymentRequest_reviewerId_reviewedAt_idx" ON "PrizePaymentRequest"("reviewerId", "reviewedAt");

ALTER TABLE "PrizePaymentRequest" ADD CONSTRAINT "PrizePaymentRequest_participationLineId_fkey"
  FOREIGN KEY ("participationLineId") REFERENCES "NumericParticipationLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrizePaymentRequest" ADD CONSTRAINT "PrizePaymentRequest_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrizePaymentRequest" ADD CONSTRAINT "PrizePaymentRequest_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
