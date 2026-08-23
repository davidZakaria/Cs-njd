-- CreateEnum
CREATE TYPE "FinishingPhase" AS ENUM (
  'NOT_STARTED',
  'PLUMBING',
  'ELECTRICAL',
  'PLASTERING',
  'GYPSUM_BOARD',
  'CERAMIC',
  'PAINTING',
  'SANITARY',
  'FINISHED'
);

-- AlterTable
ALTER TABLE "Finishing" ADD COLUMN "phase" "FinishingPhase" DEFAULT 'NOT_STARTED';

-- CreateIndex
CREATE INDEX "Finishing_phase_idx" ON "Finishing"("phase");
