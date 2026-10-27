-- Structured unit swap history (display via i18n + Cairo timezone)
ALTER TABLE "Unit" ADD COLUMN "swapOutgoingUnitId" TEXT;
ALTER TABLE "Unit" ADD COLUMN "swapOutgoingUnitCode" TEXT;
ALTER TABLE "Unit" ADD COLUMN "swapOutgoingProjectName" TEXT;
ALTER TABLE "Unit" ADD COLUMN "swapOutgoingAt" TIMESTAMP(3);
ALTER TABLE "Unit" ADD COLUMN "swapOutgoingByUserId" TEXT;
ALTER TABLE "Unit" ADD COLUMN "swapOutgoingByName" TEXT;
ALTER TABLE "Unit" ADD COLUMN "swapOutgoingClientName" TEXT;

ALTER TABLE "Unit" ADD COLUMN "swappedFromUnitCode" TEXT;
ALTER TABLE "Unit" ADD COLUMN "swappedFromProjectName" TEXT;
ALTER TABLE "Unit" ADD COLUMN "swappedFromByUserId" TEXT;
ALTER TABLE "Unit" ADD COLUMN "swappedFromByName" TEXT;
