-- Airtight edge-case gates: legal block, PoA, inspection, custom modifications

ALTER TABLE "ContractWorkflow"
  ADD COLUMN "isLegallyBlocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "powerOfAttorneyReceived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "inspectionDate" TIMESTAMP(3);

CREATE INDEX "ContractWorkflow_isLegallyBlocked_idx" ON "ContractWorkflow"("isLegallyBlocked");

ALTER TABLE "Finishing"
  ADD COLUMN "customModifications" TEXT,
  ADD COLUMN "modificationsCompleted" BOOLEAN NOT NULL DEFAULT true;
