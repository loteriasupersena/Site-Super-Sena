ALTER TYPE "UserRole" ADD VALUE 'STORE_ADMIN';

CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "commissionRateBasisPoints" INTEGER NOT NULL,
    "couponLimit" INTEGER NOT NULL DEFAULT 100,
    "adminUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Store_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Store_commissionRateBasisPoints_check" CHECK ("commissionRateBasisPoints" >= 0 AND "commissionRateBasisPoints" <= 10000),
    CONSTRAINT "Store_couponLimit_check" CHECK ("couponLimit" > 0)
);

ALTER TABLE "User" ADD COLUMN "storeId" TEXT;

CREATE UNIQUE INDEX "Store_adminUserId_key" ON "Store"("adminUserId");
CREATE INDEX "Store_status_createdAt_idx" ON "Store"("status", "createdAt");
CREATE INDEX "User_storeId_idx" ON "User"("storeId");

ALTER TABLE "Store"
  ADD CONSTRAINT "Store_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User"
  ADD CONSTRAINT "User_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
