UPDATE "PrizePaymentRequest"
SET "pixKeyEncrypted" = NULL
WHERE "status" IN ('PAID', 'REJECTED');

ALTER TABLE "PrizePaymentRequest"
ALTER COLUMN "pixKeyEncrypted" DROP NOT NULL;
