ALTER TABLE "CouponQueueState"
  DROP CONSTRAINT "CouponQueueState_count_check";

ALTER TABLE "CouponQueueState"
  ADD CONSTRAINT "CouponQueueState_count_check"
  CHECK ("currentBatchCount" >= 0 AND "currentBatchCount" <= 100000);

ALTER TABLE "CouponBatch"
  ADD COLUMN "batchSize" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "winnersPerBatch" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "ruleVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "CouponBatch"
  DROP CONSTRAINT "CouponBatch_winnerCouponId_fkey";

DROP INDEX "CouponBatch_winnerCouponId_key";

ALTER TABLE "CouponBatch"
  DROP COLUMN "winnerCouponId";

ALTER TABLE "CouponBatch"
  ADD CONSTRAINT "CouponBatch_batchSize_check"
    CHECK ("batchSize" BETWEEN 1 AND 100000),
  ADD CONSTRAINT "CouponBatch_winnersPerBatch_check"
    CHECK ("winnersPerBatch" >= 1 AND "winnersPerBatch" <= "batchSize"),
  ADD CONSTRAINT "CouponBatch_ruleVersion_check"
    CHECK ("ruleVersion" >= 1);

CREATE TABLE "CouponDrawConfig" (
  "id" TEXT NOT NULL,
  "batchSize" INTEGER NOT NULL,
  "winnersPerBatch" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponDrawConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponDrawConfig_batchSize_check" CHECK ("batchSize" BETWEEN 1 AND 100000),
  CONSTRAINT "CouponDrawConfig_winnersPerBatch_check" CHECK ("winnersPerBatch" >= 1 AND "winnersPerBatch" <= "batchSize"),
  CONSTRAINT "CouponDrawConfig_version_check" CHECK ("version" >= 1)
);

INSERT INTO "CouponDrawConfig" ("id", "batchSize", "winnersPerBatch", "version")
VALUES ('global', 100, 1, 1);
