ALTER TYPE "CouponStatus" ADD VALUE IF NOT EXISTS 'STORE_CLAIMABLE';
ALTER TYPE "CouponStatus" ADD VALUE IF NOT EXISTS 'STORE_REDEEMED';

ALTER TABLE "Coupon"
  DROP COLUMN "customerWhatsapp",
  ADD COLUMN "customerRedemptionDeadline" TIMESTAMP(3),
  ADD COLUMN "storeClaimedAt" TIMESTAMP(3),
  ADD COLUMN "storeClaimedById" TEXT;

ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_storeClaimedById_fkey"
  FOREIGN KEY ("storeClaimedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Coupon_status_customerRedemptionDeadline_idx"
  ON "Coupon"("status", "customerRedemptionDeadline");
CREATE INDEX "Coupon_storeClaimedById_storeClaimedAt_idx"
  ON "Coupon"("storeClaimedById", "storeClaimedAt");
