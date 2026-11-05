-- Personal work assignment: claim unit cycle stages and approval steps.

ALTER TABLE "UnitCycleStage"
ADD COLUMN "assignedUserId" TEXT;

ALTER TABLE "UnitCycleStage"
ADD CONSTRAINT "UnitCycleStage_assignedUserId_fkey"
FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "UnitCycleStage_assignedUserId_status_idx"
ON "UnitCycleStage"("assignedUserId", "status");

ALTER TABLE "UnitRequest"
ADD COLUMN "assignedApproverUserId" TEXT;

ALTER TABLE "UnitRequest"
ADD CONSTRAINT "UnitRequest_assignedApproverUserId_fkey"
FOREIGN KEY ("assignedApproverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "UnitRequest_assignedApproverUserId_status_idx"
ON "UnitRequest"("assignedApproverUserId", "status");
