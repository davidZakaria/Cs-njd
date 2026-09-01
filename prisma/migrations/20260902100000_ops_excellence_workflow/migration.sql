-- Replace FinishingPhase enum with 9-step engineering sequence + NOT_STARTED

CREATE TYPE "FinishingPhase_new" AS ENUM (
  'NOT_STARTED',
  'PLUMBING_FOUNDATION',
  'ELECTRICAL_FOUNDATION',
  'PLASTERING_FOUNDATION',
  'CERAMIC_WORKS',
  'PAINTING_FINISHES',
  'ELECTRICAL_FINISHES',
  'INTERNAL_DOORS',
  'SANITARY_MIXERS',
  'FINAL_PAINT'
);

-- Map legacy single phase column
ALTER TABLE "Finishing" ALTER COLUMN "phase" DROP DEFAULT;

ALTER TABLE "Finishing"
  ALTER COLUMN "phase" TYPE "FinishingPhase_new"
  USING (
    CASE "phase"::text
      WHEN 'NOT_STARTED' THEN 'NOT_STARTED'
      WHEN 'PLUMBING' THEN 'PLUMBING_FOUNDATION'
      WHEN 'ELECTRICAL' THEN 'ELECTRICAL_FOUNDATION'
      WHEN 'PLASTERING' THEN 'PLASTERING_FOUNDATION'
      WHEN 'GYPSUM_BOARD' THEN 'PLASTERING_FOUNDATION'
      WHEN 'CERAMIC' THEN 'CERAMIC_WORKS'
      WHEN 'PAINTING' THEN 'PAINTING_FINISHES'
      WHEN 'SANITARY' THEN 'SANITARY_MIXERS'
      WHEN 'FINISHED' THEN 'FINAL_PAINT'
      ELSE 'NOT_STARTED'
    END
  )::"FinishingPhase_new";

-- Map legacy phases array (handles FINISHED -> all 9 engineering steps)
CREATE OR REPLACE FUNCTION migrate_finishing_phases_array(
  old_phases "FinishingPhase"[]
) RETURNS "FinishingPhase_new"[] AS $$
DECLARE
  result "FinishingPhase_new"[] := ARRAY[]::"FinishingPhase_new"[];
  elem text;
  mapped "FinishingPhase_new";
  all_engineering "FinishingPhase_new"[] := ARRAY[
    'PLUMBING_FOUNDATION',
    'ELECTRICAL_FOUNDATION',
    'PLASTERING_FOUNDATION',
    'CERAMIC_WORKS',
    'PAINTING_FINISHES',
    'ELECTRICAL_FINISHES',
    'INTERNAL_DOORS',
    'SANITARY_MIXERS',
    'FINAL_PAINT'
  ]::"FinishingPhase_new"[];
BEGIN
  IF old_phases IS NULL OR COALESCE(array_length(old_phases, 1), 0) = 0 THEN
    RETURN ARRAY[]::"FinishingPhase_new"[];
  END IF;

  IF 'FINISHED' = ANY (ARRAY(SELECT unnest(old_phases)::text)) THEN
    RETURN all_engineering;
  END IF;

  FOREACH elem IN ARRAY ARRAY(SELECT unnest(old_phases)::text)
  LOOP
    mapped := CASE elem
      WHEN 'NOT_STARTED' THEN 'NOT_STARTED'::"FinishingPhase_new"
      WHEN 'PLUMBING' THEN 'PLUMBING_FOUNDATION'::"FinishingPhase_new"
      WHEN 'ELECTRICAL' THEN 'ELECTRICAL_FOUNDATION'::"FinishingPhase_new"
      WHEN 'PLASTERING' THEN 'PLASTERING_FOUNDATION'::"FinishingPhase_new"
      WHEN 'GYPSUM_BOARD' THEN 'PLASTERING_FOUNDATION'::"FinishingPhase_new"
      WHEN 'CERAMIC' THEN 'CERAMIC_WORKS'::"FinishingPhase_new"
      WHEN 'PAINTING' THEN 'PAINTING_FINISHES'::"FinishingPhase_new"
      WHEN 'SANITARY' THEN 'SANITARY_MIXERS'::"FinishingPhase_new"
      WHEN 'FINISHED' THEN 'FINAL_PAINT'::"FinishingPhase_new"
      ELSE 'NOT_STARTED'::"FinishingPhase_new"
    END;

    IF NOT (mapped = ANY (result)) THEN
      result := array_append(result, mapped);
    END IF;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DROP INDEX IF EXISTS "Finishing_phases_idx";

ALTER TABLE "Finishing" ALTER COLUMN "phases" DROP DEFAULT;

ALTER TABLE "Finishing"
  ALTER COLUMN "phases" TYPE "FinishingPhase_new"[]
  USING migrate_finishing_phases_array("phases");

DROP FUNCTION migrate_finishing_phases_array("FinishingPhase"[]);

DROP TYPE "FinishingPhase";
ALTER TYPE "FinishingPhase_new" RENAME TO "FinishingPhase";

ALTER TABLE "Finishing" ALTER COLUMN "phase" SET DEFAULT 'NOT_STARTED';
ALTER TABLE "Finishing" ALTER COLUMN "phases" SET DEFAULT ARRAY[]::"FinishingPhase"[];

CREATE INDEX "Finishing_phases_idx" ON "Finishing" USING GIN ("phases");
