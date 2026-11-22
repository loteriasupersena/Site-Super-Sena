ALTER TABLE "NumericParticipationLine" ADD COLUMN "prizeExpiredAt" TIMESTAMP(3);
CREATE INDEX "NumericParticipationLine_prizeExpiredAt_idx" ON "NumericParticipationLine"("prizeExpiredAt");
