ALTER TABLE "NumericParticipationLine" ADD COLUMN "prizeExpiryReviewedAt" TIMESTAMP(3);
CREATE INDEX "NumericParticipationLine_prizeExpiryReviewedAt_idx" ON "NumericParticipationLine"("prizeExpiryReviewedAt");
