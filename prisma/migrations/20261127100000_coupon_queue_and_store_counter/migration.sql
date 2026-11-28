ALTER TABLE "Store"
  ADD COLUMN "outstandingCouponCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Store"
  ADD CONSTRAINT "Store_outstandingCouponCount_check" CHECK ("outstandingCouponCount" >= 0);

UPDATE "Store" AS s
SET "outstandingCouponCount" = (
  SELECT COUNT(*)::INTEGER
  FROM "Coupon" AS c
  WHERE c."storeId" = s."id"
    AND c."platformFeeCents" > 0
    AND NOT EXISTS (
      SELECT 1
      FROM "StoreBillingCoupon" AS link
      JOIN "StoreBilling" AS billing ON billing."id" = link."billingId"
      WHERE link."couponId" = c."id"
        AND billing."status" = 'PAID'
    )
);

CREATE TABLE "CouponQueueState" (
  "id" TEXT NOT NULL,
  "currentBatchId" TEXT,
  "currentBatchSequence" INTEGER NOT NULL,
  "currentBatchCount" INTEGER NOT NULL DEFAULT 0,
  "nextBatchSequence" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponQueueState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponQueueState_count_check" CHECK ("currentBatchCount" >= 0 AND "currentBatchCount" <= 100),
  CONSTRAINT "CouponQueueState_sequence_check" CHECK ("currentBatchSequence" > 0 AND "nextBatchSequence" > 0)
);

DO $$
DECLARE
  active_id TEXT;
  active_count INTEGER;
  active_sequence INTEGER;
  next_sequence INTEGER;
BEGIN
  SELECT b."id", b."sequenceNumber", COUNT(c."id")::INTEGER
    INTO active_id, active_sequence, active_count
  FROM "CouponBatch" b
  LEFT JOIN "Coupon" c ON c."batchId" = b."id"
  WHERE b."status" = 'OPEN'
  GROUP BY b."id", b."sequenceNumber"
  ORDER BY b."sequenceNumber" DESC
  LIMIT 1;

  IF active_id IS NULL THEN
    SELECT COALESCE(MAX("sequenceNumber"), 0) + 1
      INTO active_sequence
    FROM "CouponBatch";
    active_id := 'queue-initial-' || active_sequence::TEXT;
    INSERT INTO "CouponBatch" ("id", "sequenceNumber", "status")
      VALUES (active_id, active_sequence, 'OPEN');
    active_count := 0;
  END IF;

  IF active_count >= 100 THEN
    RAISE EXCEPTION 'Cannot initialize coupon queue: open batch % already has % coupons', active_id, active_count;
  END IF;

  SELECT COALESCE(MAX("sequenceNumber"), 0) + 1
    INTO next_sequence
  FROM "CouponBatch";

  INSERT INTO "CouponQueueState" (
    "id", "currentBatchId", "currentBatchSequence", "currentBatchCount", "nextBatchSequence"
  ) VALUES (
    'global', active_id, active_sequence, active_count, next_sequence
  );
END $$;
