-- Keep every payout attempt in its own batch while allowing a failed prize to be requested again.
-- The (batchId, participationLineId) unique index still prevents duplicate lines inside one batch.
DROP INDEX IF EXISTS "PrizePaymentBatchItem_participationLineId_key";
