ALTER TABLE "Round" ADD COLUMN "resultPublishedAt" TIMESTAMP(3);

-- Recover the actual publication moment from the draw audit event when possible.
-- Older rounds without that event fall back to the round update timestamp,
-- not the scheduled resultAt time, because the deadline starts when drawn.
UPDATE "Round" AS r
SET "resultPublishedAt" = COALESCE(
  (SELECT MIN(a."createdAt") FROM "AuditEvent" a
   WHERE a."entityType" = 'Round' AND a."entityId" = r."id"
     AND a."action" IN ('NUMERIC_ROUND_DRAWN', 'NUMERIC_ROUND_DRAWN_AUTOMATICALLY')),
  r."updatedAt"
)
WHERE r."status" = 'COMPLETED' AND r."resultNumber" IS NOT NULL;

CREATE INDEX "Round_resultPublishedAt_idx" ON "Round"("resultPublishedAt");
