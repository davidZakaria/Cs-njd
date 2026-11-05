-- Bulk archive-check parents are project-scoped, not tied to a unit.
ALTER TABLE "UnitRequest" ALTER COLUMN "unitId" DROP NOT NULL;

UPDATE "UnitRequest"
SET "unitId" = NULL
WHERE "bulkProjectId" IS NOT NULL AND "parentRequestId" IS NULL;
