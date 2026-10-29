-- CreateEnum
CREATE TYPE "EngineeringApprovalKind" AS ENUM (
  'SITE_VISIT_COMPLETION',
  'SNAG_DEFECT_CLOSURE',
  'READINESS_SIGN_OFF',
  'DATA_ENTRY'
);

-- CreateTable
CREATE TABLE "UnitEngineeringApproval" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "kind" "EngineeringApprovalKind" NOT NULL,
  "approvedById" TEXT NOT NULL,
  "summary" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UnitEngineeringApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitEngineeringApproval_unitId_createdAt_idx" ON "UnitEngineeringApproval"("unitId", "createdAt");

CREATE INDEX "UnitEngineeringApproval_approvedById_idx" ON "UnitEngineeringApproval"("approvedById");

-- AddForeignKey
ALTER TABLE "UnitEngineeringApproval" ADD CONSTRAINT "UnitEngineeringApproval_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UnitEngineeringApproval" ADD CONSTRAINT "UnitEngineeringApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
