ALTER TABLE "Payment" ADD COLUMN "providerQrCodeId" TEXT;
CREATE UNIQUE INDEX "Payment_providerQrCodeId_key" ON "Payment"("providerQrCodeId");
