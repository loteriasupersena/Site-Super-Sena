-- A winning line can appear in multiple batches over time after a confirmed terminal failure.
-- Keep uniqueness within each batch, but allow a later retry to create a new batch item.
DROP INDEX IF EXISTS "PrizePaymentBatchItem_participationLineId_key";
