-- The database is empty and the numeric game is being reset to the six-digit rules.
ALTER TABLE "NumericParticipationLine" RENAME COLUMN "thousandsCents" TO "quadraCents";
ALTER TABLE "NumericParticipationLine" ADD COLUMN "senaCents" INTEGER NOT NULL DEFAULT 0;

-- Replace the original five-digit database guards with the six-digit format.
ALTER TABLE "Round" DROP CONSTRAINT "Round_resultNumber_format_check";
ALTER TABLE "Round"
  ADD CONSTRAINT "Round_resultNumber_format_check"
  CHECK ("resultNumber" IS NULL OR "resultNumber" ~ '^[0-9]{6}$');

ALTER TABLE "NumericParticipationLine" DROP CONSTRAINT "NumericParticipationLine_numberValue_format_check";
ALTER TABLE "NumericParticipationLine"
  ADD CONSTRAINT "NumericParticipationLine_numberValue_format_check"
  CHECK ("numberValue" ~ '^[0-9]{6}$');
