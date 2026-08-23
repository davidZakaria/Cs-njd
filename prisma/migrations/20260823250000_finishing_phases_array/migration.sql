-- AlterTable
ALTER TABLE "Finishing" ADD COLUMN "phases" "FinishingPhase"[] DEFAULT ARRAY[]::"FinishingPhase"[];

-- Backfill from legacy single phase column
UPDATE "Finishing"
SET "phases" = ARRAY["phase"]
WHERE "phase" IS NOT NULL;

UPDATE "Finishing"
SET "phases" = ARRAY['NOT_STARTED']::"FinishingPhase"[]
WHERE COALESCE(array_length("phases", 1), 0) = 0;

-- CreateIndex
CREATE INDEX "Finishing_phases_idx" ON "Finishing" USING GIN ("phases");
