CREATE TYPE "CouponStatus" AS ENUM ('ACTIVE', 'WINNER', 'REDEEMED', 'EXPIRED');
CREATE TYPE "CouponBatchStatus" AS ENUM ('OPEN', 'DRAWN');

CREATE TABLE "CouponBatch" (
  "id" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "status" "CouponBatchStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "winnerCouponId" TEXT,
  CONSTRAINT "CouponBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponBatch_sequenceNumber_check" CHECK ("sequenceNumber" > 0)
);

CREATE TABLE "Coupon" (
  "id" TEXT NOT NULL,
  "publicCode" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "issuedById" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "purchaseAmountCents" INTEGER NOT NULL,
  "commissionRateBasisPoints" INTEGER NOT NULL,
  "platformFeeCents" INTEGER NOT NULL,
  "customerWhatsapp" TEXT,
  "status" "CouponStatus" NOT NULL DEFAULT 'ACTIVE',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "drawnAt" TIMESTAMP(3),
  "redeemedAt" TIMESTAMP(3),
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Coupon_purchaseAmountCents_check" CHECK ("purchaseAmountCents" > 0),
  CONSTRAINT "Coupon_commissionRateBasisPoints_check" CHECK ("commissionRateBasisPoints" >= 0),
  CONSTRAINT "Coupon_platformFeeCents_check" CHECK ("platformFeeCents" >= 0)
);

CREATE UNIQUE INDEX "CouponBatch_sequenceNumber_key" ON "CouponBatch"("sequenceNumber");
CREATE UNIQUE INDEX "CouponBatch_winnerCouponId_key" ON "CouponBatch"("winnerCouponId");
CREATE INDEX "CouponBatch_status_sequenceNumber_idx" ON "CouponBatch"("status", "sequenceNumber");
CREATE UNIQUE INDEX "Coupon_publicCode_key" ON "Coupon"("publicCode");
CREATE INDEX "Coupon_storeId_issuedAt_idx" ON "Coupon"("storeId", "issuedAt");
CREATE INDEX "Coupon_issuedById_issuedAt_idx" ON "Coupon"("issuedById", "issuedAt");
CREATE INDEX "Coupon_batchId_issuedAt_idx" ON "Coupon"("batchId", "issuedAt");
CREATE INDEX "Coupon_status_issuedAt_idx" ON "Coupon"("status", "issuedAt");

ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_issuedById_fkey"
  FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "CouponBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponBatch"
  ADD CONSTRAINT "CouponBatch_winnerCouponId_fkey"
  FOREIGN KEY ("winnerCouponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
