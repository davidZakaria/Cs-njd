-- Unit swap history on units
ALTER TABLE "Unit" ADD COLUMN "swapHistoryNote" TEXT;
ALTER TABLE "Unit" ADD COLUMN "swappedFromUnitId" TEXT;
ALTER TABLE "Unit" ADD COLUMN "swappedFromAt" TIMESTAMP(3);

-- Contract review flags after client swap to a new unit
ALTER TABLE "ContractWorkflow" ADD COLUMN "contractUnitUpdateFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Finishing" ADD COLUMN "finishingContractNeedsUnitUpdate" BOOLEAN NOT NULL DEFAULT false;
