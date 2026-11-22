ALTER TABLE "Round" ADD COLUMN "resultPublishedAt" TIMESTAMP(3);

-- Historical completed rounds use their scheduled result timestamp as the
-- best available publication reference; new draws record the actual DB time.
UPDATE "Round"
SET "resultPublishedAt" = COALESCE("resultAt", "updatedAt")
WHERE "status" = 'COMPLETED' AND "resultNumber" IS NOT NULL;

CREATE INDEX "Round_resultPublishedAt_idx" ON "Round"("resultPublishedAt");
