-- CreateEnum
CREATE TYPE "UnitCycleStageKey" AS ENUM ('CONTRACT', 'FINANCE', 'ENGINEERING', 'LEGAL_HANDOVER');

-- CreateEnum
CREATE TYPE "UnitCycleStageStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "unitCycleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unitCycleContractDeadlineDays" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "unitCycleFinanceDeadlineDays" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "unitCycleEngineeringDeadlineDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "unitCycleLegalHandoverDeadlineDays" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "UnitCycle" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitCycleStage" (
    "id" TEXT NOT NULL,
    "unitCycleId" TEXT NOT NULL,
    "stageKey" "UnitCycleStageKey" NOT NULL,
    "status" "UnitCycleStageStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "ownerRole" "Role" NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "blockedReason" TEXT,
    "lastEscalatedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "UnitCycleStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitCycleAuditEvent" (
    "id" TEXT NOT NULL,
    "unitCycleId" TEXT NOT NULL,
    "stageKey" "UnitCycleStageKey",
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitCycleAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitCycle_unitId_key" ON "UnitCycle"("unitId");

-- CreateIndex
CREATE INDEX "UnitCycle_unitId_idx" ON "UnitCycle"("unitId");

-- CreateIndex
CREATE INDEX "UnitCycleStage_unitCycleId_idx" ON "UnitCycleStage"("unitCycleId");

-- CreateIndex
CREATE INDEX "UnitCycleStage_status_idx" ON "UnitCycleStage"("status");

-- CreateIndex
CREATE INDEX "UnitCycleStage_deadlineAt_idx" ON "UnitCycleStage"("deadlineAt");

-- CreateIndex
CREATE INDEX "UnitCycleStage_ownerRole_status_idx" ON "UnitCycleStage"("ownerRole", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UnitCycleStage_unitCycleId_stageKey_key" ON "UnitCycleStage"("unitCycleId", "stageKey");

-- CreateIndex
CREATE INDEX "UnitCycleAuditEvent_unitCycleId_idx" ON "UnitCycleAuditEvent"("unitCycleId");

-- CreateIndex
CREATE INDEX "UnitCycleAuditEvent_createdAt_idx" ON "UnitCycleAuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "UnitCycle" ADD CONSTRAINT "UnitCycle_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitCycleStage" ADD CONSTRAINT "UnitCycleStage_unitCycleId_fkey" FOREIGN KEY ("unitCycleId") REFERENCES "UnitCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitCycleAuditEvent" ADD CONSTRAINT "UnitCycleAuditEvent_unitCycleId_fkey" FOREIGN KEY ("unitCycleId") REFERENCES "UnitCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
