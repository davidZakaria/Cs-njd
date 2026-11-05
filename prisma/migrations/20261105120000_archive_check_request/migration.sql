-- AlterEnum
ALTER TYPE "UnitRequestType" ADD VALUE 'ARCHIVE_CHECK';
ALTER TYPE "UnitRequestApproverKind" ADD VALUE 'OPERATIONS';

-- CreateEnum
CREATE TYPE "ArchiveCheckItemStatus" AS ENUM ('PENDING', 'FOUND', 'MISSING', 'UNSIGNED');
CREATE TYPE "ArchiveCheckGapTaskStatus" AS ENUM ('OPEN', 'COMPLETED');

-- AlterTable
ALTER TABLE "UnitRequest" ADD COLUMN "parentRequestId" TEXT,
ADD COLUMN "bulkProjectId" TEXT,
ADD COLUMN "archiveCheckSubmittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RequestAttachment" ADD COLUMN "archiveCheckItemKey" TEXT;

-- CreateTable
CREATE TABLE "ArchiveCheckItem" (
    "id" TEXT NOT NULL,
    "unitRequestId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "status" "ArchiveCheckItemStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveCheckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveCheckGapTask" (
    "id" TEXT NOT NULL,
    "unitRequestId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerRole" "Role" NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "status" "ArchiveCheckGapTaskStatus" NOT NULL DEFAULT 'OPEN',
    "unitCycleStageKey" "UnitCycleStageKey",
    "escalatedToManagement" BOOLEAN NOT NULL DEFAULT false,
    "lastEscalatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveCheckGapTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitRequest_parentRequestId_idx" ON "UnitRequest"("parentRequestId");
CREATE INDEX "UnitRequest_bulkProjectId_idx" ON "UnitRequest"("bulkProjectId");
CREATE INDEX "RequestAttachment_requestId_archiveCheckItemKey_idx" ON "RequestAttachment"("requestId", "archiveCheckItemKey");
CREATE UNIQUE INDEX "ArchiveCheckItem_unitRequestId_itemKey_key" ON "ArchiveCheckItem"("unitRequestId", "itemKey");
CREATE INDEX "ArchiveCheckItem_unitRequestId_idx" ON "ArchiveCheckItem"("unitRequestId");
CREATE INDEX "ArchiveCheckGapTask_unitRequestId_idx" ON "ArchiveCheckGapTask"("unitRequestId");
CREATE INDEX "ArchiveCheckGapTask_ownerUserId_status_idx" ON "ArchiveCheckGapTask"("ownerUserId", "status");
CREATE INDEX "ArchiveCheckGapTask_ownerRole_status_idx" ON "ArchiveCheckGapTask"("ownerRole", "status");
CREATE INDEX "ArchiveCheckGapTask_status_deadlineAt_idx" ON "ArchiveCheckGapTask"("status", "deadlineAt");

-- AddForeignKey
ALTER TABLE "UnitRequest" ADD CONSTRAINT "UnitRequest_parentRequestId_fkey" FOREIGN KEY ("parentRequestId") REFERENCES "UnitRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnitRequest" ADD CONSTRAINT "UnitRequest_bulkProjectId_fkey" FOREIGN KEY ("bulkProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArchiveCheckItem" ADD CONSTRAINT "ArchiveCheckItem_unitRequestId_fkey" FOREIGN KEY ("unitRequestId") REFERENCES "UnitRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchiveCheckGapTask" ADD CONSTRAINT "ArchiveCheckGapTask_unitRequestId_fkey" FOREIGN KEY ("unitRequestId") REFERENCES "UnitRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchiveCheckGapTask" ADD CONSTRAINT "ArchiveCheckGapTask_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArchiveCheckGapTask" ADD CONSTRAINT "ArchiveCheckGapTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
