ALTER TABLE "CouponPayout" ADD COLUMN "requestedById" TEXT;
CREATE INDEX "CouponPayout_requestedById_createdAt_idx" ON "CouponPayout"("requestedById", "createdAt");
ALTER TABLE "CouponPayout" ADD CONSTRAINT "CouponPayout_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
