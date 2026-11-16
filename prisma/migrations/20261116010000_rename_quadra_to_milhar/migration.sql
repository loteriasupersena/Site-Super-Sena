-- Rename the existing four-digit prize field without discarding historical records.
ALTER TABLE "NumericParticipationLine"
  RENAME COLUMN "quadraCents" TO "milharCents";

-- Preserve historical rule snapshots while renaming the category key.
UPDATE "NumericParticipationLine"
SET "ruleSnapshot" = jsonb_set(
  "ruleSnapshot",
  '{multipliers,milhar}',
  "ruleSnapshot" #> '{multipliers,quadra}',
  true
) #- '{multipliers,quadra}'
WHERE "ruleSnapshot" #> '{multipliers,quadra}' IS NOT NULL
  AND "ruleSnapshot" #> '{multipliers,milhar}' IS NULL;

-- Preserve the allocation saved with each purchase intent.
UPDATE "NumericPurchaseIntent"
SET "allocation" = jsonb_set(
  "allocation",
  '{milharCents}',
  "allocation" -> 'quadraCents',
  true
) - 'quadraCents'
WHERE "allocation" ? 'quadraCents'
  AND NOT ("allocation" ? 'milharCents');

-- Preserve the purchase intent's historical prize-rule snapshot.
UPDATE "NumericPurchaseIntent"
SET "ruleSnapshot" = jsonb_set(
  "ruleSnapshot",
  '{multipliers,milhar}',
  "ruleSnapshot" #> '{multipliers,quadra}',
  true
) #- '{multipliers,quadra}'
WHERE "ruleSnapshot" #> '{multipliers,quadra}' IS NOT NULL
  AND "ruleSnapshot" #> '{multipliers,milhar}' IS NULL;

-- Keep the active multiplier configuration compatible with the new category key.
UPDATE "Setting"
SET "value" = replace("value", '"quadra"', '"milhar"')
WHERE "key" = 'numeric_prize_multipliers'
  AND "value" LIKE '%"quadra"%';

-- Preserve the historical configuration audit trail with the renamed key.
UPDATE "SettingChange"
SET "oldValue" = replace("oldValue", '"quadra"', '"milhar"')
WHERE "settingKey" = 'numeric_prize_multipliers'
  AND "oldValue" LIKE '%"quadra"%';

UPDATE "SettingChange"
SET "newValue" = replace("newValue", '"quadra"', '"milhar"')
WHERE "settingKey" = 'numeric_prize_multipliers'
  AND "newValue" LIKE '%"quadra"%';
