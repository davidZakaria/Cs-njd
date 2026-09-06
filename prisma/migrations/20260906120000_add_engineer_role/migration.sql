-- AlterEnum: Role
ALTER TYPE "Role" ADD VALUE 'ENGINEER';

-- AlterEnum: PendingParty
ALTER TYPE "PendingParty" ADD VALUE 'CUSTOMER_SERVICE';

-- AlterTable: Unit
ALTER TABLE "Unit" ADD COLUMN "assignedEngineerId" TEXT;

-- AlterTable: Ticket
ALTER TABLE "Ticket" ADD COLUMN "engineeringNotes" TEXT;

-- CreateIndex
CREATE INDEX "Unit_assignedEngineerId_idx" ON "Unit"("assignedEngineerId");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_assignedEngineerId_fkey" FOREIGN KEY ("assignedEngineerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
