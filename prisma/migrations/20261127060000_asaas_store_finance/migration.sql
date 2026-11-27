CREATE TYPE "StoreBillingStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');
CREATE TYPE "CouponPayoutKind" AS ENUM ('CUSTOMER_REDEMPTION', 'STORE_EXPIRED_CLAIM');
CREATE TYPE "CouponPayoutMethod" AS ENUM ('GOODS', 'PIX');
CREATE TYPE "CouponPayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'UNKNOWN');

CREATE TABLE "StoreBilling" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" "StoreBillingStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "externalReference" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'ASAAS',
  "providerPaymentId" TEXT,
  "providerQrCodeId" TEXT,
  "pixCopyPaste" TEXT,
  "pixQrCodeBase64" TEXT,
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "lastProviderStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreBilling_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CouponPayout" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "kind" "CouponPayoutKind" NOT NULL,
  "method" "CouponPayoutMethod",
  "status" "CouponPayoutStatus" NOT NULL DEFAULT 'PENDING',
  "amountCents" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "externalReference" TEXT NOT NULL,
  "provider" TEXT,
  "providerTransferId" TEXT,
  "providerStatus" TEXT,
  "providerReceiptUrl" TEXT,
  "providerFailureReason" TEXT,
  "pixKeyCiphertext" TEXT,
  "pixKeyMasked" TEXT,
  "pixKeyType" TEXT,
  "requestedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CouponPayout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorePixKey" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "keyCiphertext" TEXT NOT NULL,
  "keyMasked" TEXT NOT NULL,
  "keyType" TEXT NOT NULL,
  "validatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorePixKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AsaasWebhookEvent" (
  "id" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payloadDigest" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "processingError" TEXT,
  CONSTRAINT "AsaasWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreBilling_idempotencyKey_key" ON "StoreBilling"("idempotencyKey");
CREATE UNIQUE INDEX "StoreBilling_externalReference_key" ON "StoreBilling"("externalReference");
CREATE UNIQUE INDEX "StoreBilling_providerPaymentId_key" ON "StoreBilling"("providerPaymentId");
CREATE UNIQUE INDEX "StoreBilling_providerQrCodeId_key" ON "StoreBilling"("providerQrCodeId");
CREATE UNIQUE INDEX "StoreBilling_storeId_periodKey_key" ON "StoreBilling"("storeId", "periodKey");
CREATE INDEX "StoreBilling_storeId_status_createdAt_idx" ON "StoreBilling"("storeId", "status", "createdAt");
CREATE INDEX "StoreBilling_status_updatedAt_idx" ON "StoreBilling"("status", "updatedAt");

CREATE UNIQUE INDEX "CouponPayout_couponId_key" ON "CouponPayout"("couponId");
CREATE UNIQUE INDEX "CouponPayout_idempotencyKey_key" ON "CouponPayout"("idempotencyKey");
CREATE UNIQUE INDEX "CouponPayout_externalReference_key" ON "CouponPayout"("externalReference");
CREATE UNIQUE INDEX "CouponPayout_providerTransferId_key" ON "CouponPayout"("providerTransferId");
CREATE INDEX "CouponPayout_storeId_kind_status_createdAt_idx" ON "CouponPayout"("storeId", "kind", "status", "createdAt");
CREATE INDEX "CouponPayout_status_updatedAt_idx" ON "CouponPayout"("status", "updatedAt");

CREATE UNIQUE INDEX "StorePixKey_storeId_key" ON "StorePixKey"("storeId");
CREATE UNIQUE INDEX "AsaasWebhookEvent_providerEventId_key" ON "AsaasWebhookEvent"("providerEventId");
CREATE INDEX "AsaasWebhookEvent_processedAt_receivedAt_idx" ON "AsaasWebhookEvent"("processedAt", "receivedAt");

ALTER TABLE "StoreBilling" ADD CONSTRAINT "StoreBilling_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponPayout" ADD CONSTRAINT "CouponPayout_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponPayout" ADD CONSTRAINT "CouponPayout_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorePixKey" ADD CONSTRAINT "StorePixKey_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
