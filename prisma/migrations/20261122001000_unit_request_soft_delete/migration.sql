-- Soft-delete unit requests (retain records for audit/history)
ALTER TABLE "UnitRequest" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "UnitRequest" ADD COLUMN "deletedById" TEXT;
ALTER TABLE "UnitRequest" ADD COLUMN "deleteReason" TEXT;

-- Foreign key for deletedBy user
ALTER TABLE "UnitRequest" ADD CONSTRAINT "UnitRequest_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for filtering out deleted requests
CREATE INDEX "UnitRequest_deletedAt_idx" ON "UnitRequest"("deletedAt");
