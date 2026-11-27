ALTER TABLE "Coupon"
  ADD COLUMN "idempotencyKey" TEXT;

UPDATE "Coupon"
SET "idempotencyKey" = 'legacy:' || "id"
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "Coupon"
  ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE UNIQUE INDEX "Coupon_idempotencyKey_key"
  ON "Coupon"("idempotencyKey");
