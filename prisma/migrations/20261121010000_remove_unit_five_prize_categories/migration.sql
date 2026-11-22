-- Replace the six-category numeric game with five prize categories.
-- Preserve each line's original total stake. The five new allocations use floor(total / 5)
-- and assign every remainder cent to Dezena. Existing calculated prize amounts remain unchanged.
UPDATE "NumericParticipationLine" AS nl
SET
  "tensCents" = base.share + base.remainder,
  "hundredsCents" = base.share,
  "milharCents" = base.share,
  "quinaCents" = base.share,
  "senaCents" = base.share,
  "ruleVersion" = CASE WHEN nl."prizeCents" IS NULL THEN 'numeric-six-digit-five-prizes-v3' ELSE nl."ruleVersion" END,
  "ruleSnapshot" = CASE WHEN nl."prizeCents" IS NULL THEN jsonb_build_object(
    'version', 'numeric-six-digit-five-prizes-v3',
    'multipliers', jsonb_build_object(
      'tens', COALESCE((nl."ruleSnapshot"->'multipliers'->>'tens')::integer, 20),
      'hundreds', COALESCE((nl."ruleSnapshot"->'multipliers'->>'hundreds')::integer, 200),
      'milhar', COALESCE((nl."ruleSnapshot"->'multipliers'->>'milhar')::integer, 2000),
      'quina', COALESCE((nl."ruleSnapshot"->'multipliers'->>'quina')::integer, 20000),
      'sena', COALESCE((nl."ruleSnapshot"->'multipliers'->>'sena')::integer, 200000)
    )
  ) ELSE nl."ruleSnapshot" END
FROM (
  SELECT
    "id",
    FLOOR(("unitCents" + "tensCents" + "hundredsCents" + "milharCents" + "quinaCents" + "senaCents")::numeric / 5)::integer AS share,
    MOD(("unitCents" + "tensCents" + "hundredsCents" + "milharCents" + "quinaCents" + "senaCents"), 5)::integer AS remainder
  FROM "NumericParticipationLine"
) AS base
WHERE nl."id" = base."id";

-- Pending cash/wallet sale intents are not attached to rounds yet. Rebuild their
-- allocation JSON with five categories and preserve their configured multipliers.
UPDATE "NumericPurchaseIntent" AS intent
SET
  "allocation" = jsonb_build_object(
    'tensCents', base.share + base.remainder,
    'hundredsCents', base.share,
    'milharCents', base.share,
    'quinaCents', base.share,
    'senaCents', base.share
  ),
  "ruleVersion" = 'numeric-six-digit-five-prizes-v3',
  "ruleSnapshot" = jsonb_build_object(
    'version', 'numeric-six-digit-five-prizes-v3',
    'multipliers', jsonb_build_object(
      'tens', COALESCE((intent."ruleSnapshot"->'multipliers'->>'tens')::integer, 20),
      'hundreds', COALESCE((intent."ruleSnapshot"->'multipliers'->>'hundreds')::integer, 200),
      'milhar', COALESCE((intent."ruleSnapshot"->'multipliers'->>'milhar')::integer, 2000),
      'quina', COALESCE((intent."ruleSnapshot"->'multipliers'->>'quina')::integer, 20000),
      'sena', COALESCE((intent."ruleSnapshot"->'multipliers'->>'sena')::integer, 200000)
    )
  )
FROM (
  SELECT
    "id",
    FLOOR((("allocation"->>'unitCents')::integer + ("allocation"->>'tensCents')::integer +
      ("allocation"->>'hundredsCents')::integer + ("allocation"->>'milharCents')::integer +
      ("allocation"->>'quinaCents')::integer + ("allocation"->>'senaCents')::integer)::numeric / 5)::integer AS share,
    MOD(("allocation"->>'unitCents')::integer + ("allocation"->>'tensCents')::integer +
      ("allocation"->>'hundredsCents')::integer + ("allocation"->>'milharCents')::integer +
      ("allocation"->>'quinaCents')::integer + ("allocation"->>'senaCents')::integer, 5)::integer AS remainder
  FROM "NumericPurchaseIntent"
) AS base
WHERE intent."id" = base."id";

-- Convert the saved admin configuration to the five supported multipliers.
UPDATE "Setting"
SET "value" = jsonb_build_object(
  'tens', COALESCE(("value"::jsonb->>'tens')::integer, 20),
  'hundreds', COALESCE(("value"::jsonb->>'hundreds')::integer, 200),
  'milhar', COALESCE(("value"::jsonb->>'milhar')::integer, 2000),
  'quina', COALESCE(("value"::jsonb->>'quina')::integer, 20000),
  'sena', COALESCE(("value"::jsonb->>'sena')::integer, 200000)
)::text
WHERE "key" = 'numeric_prize_multipliers';

ALTER TABLE "NumericParticipationLine" DROP COLUMN "unitCents";
