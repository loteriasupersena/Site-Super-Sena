-- The database is empty and the numeric game is being reset to the six-digit rules.
ALTER TABLE "NumericParticipationLine" RENAME COLUMN "thousandsCents" TO "quadraCents";
ALTER TABLE "NumericParticipationLine" ADD COLUMN "senaCents" INTEGER NOT NULL DEFAULT 0;
