CREATE TABLE "StoreBillingCoupon" (
  "id" TEXT NOT NULL,
  "billingId" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreBillingCoupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreBillingCoupon_couponId_key" ON "StoreBillingCoupon"("couponId");
CREATE UNIQUE INDEX "StoreBillingCoupon_billingId_couponId_key" ON "StoreBillingCoupon"("billingId", "couponId");
CREATE INDEX "StoreBillingCoupon_billingId_createdAt_idx" ON "StoreBillingCoupon"("billingId", "createdAt");

ALTER TABLE "StoreBillingCoupon"
  ADD CONSTRAINT "StoreBillingCoupon_billingId_fkey"
  FOREIGN KEY ("billingId") REFERENCES "StoreBilling"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoreBillingCoupon"
  ADD CONSTRAINT "StoreBillingCoupon_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
