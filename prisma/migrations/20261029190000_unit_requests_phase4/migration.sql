-- CreateEnum
CREATE TYPE "UnitRequestType" AS ENUM ('CONTRACT_ISSUE_OR_AMENDMENT', 'GRACE_PERIOD_ANNEX', 'UNIT_SWAP', 'FINISHING_PRICE_CHANGE_OR_DISCOUNT', 'PAYMENT_PLAN_CHANGE', 'REFUND', 'SITE_VISIT', 'SNAG_OR_DEFECT', 'HANDOVER_APPOINTMENT', 'DOCUMENT_CORRECTION');

-- CreateEnum
CREATE TYPE "UnitRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UnitRequestApproverKind" AS ENUM ('LEGAL', 'FINANCE', 'MANAGEMENT', 'CS_AGENT');

-- CreateTable
CREATE TABLE "UnitRequest" (
    "id" TEXT NOT NULL,
    "type" "UnitRequestType" NOT NULL,
    "unitId" TEXT NOT NULL,
    "clientId" TEXT,
    "requestedById" TEXT NOT NULL,
    "status" "UnitRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "currentApproverKind" "UnitRequestApproverKind",
    "dueDate" TIMESTAMP(3),
    "description" TEXT,
    "unitCycleStageKey" "UnitCycleStageKey",
    "linkedSwapTargetUnitId" TEXT,
    "engineeringApprovalId" TEXT,
    "escalatedToManagement" BOOLEAN NOT NULL DEFAULT false,
    "lastEscalatedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestComment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestAttachment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestAuditEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitRequest_engineeringApprovalId_key" ON "UnitRequest"("engineeringApprovalId");

-- CreateIndex
CREATE INDEX "UnitRequest_unitId_idx" ON "UnitRequest"("unitId");

-- CreateIndex
CREATE INDEX "UnitRequest_clientId_idx" ON "UnitRequest"("clientId");

-- CreateIndex
CREATE INDEX "UnitRequest_requestedById_idx" ON "UnitRequest"("requestedById");

-- CreateIndex
CREATE INDEX "UnitRequest_status_idx" ON "UnitRequest"("status");

-- CreateIndex
CREATE INDEX "UnitRequest_type_idx" ON "UnitRequest"("type");

-- CreateIndex
CREATE INDEX "UnitRequest_currentApproverKind_status_idx" ON "UnitRequest"("currentApproverKind", "status");

-- CreateIndex
CREATE INDEX "UnitRequest_dueDate_idx" ON "UnitRequest"("dueDate");

-- CreateIndex
CREATE INDEX "UnitRequest_unitCycleStageKey_idx" ON "UnitRequest"("unitCycleStageKey");

-- CreateIndex
CREATE INDEX "UnitRequest_status_dueDate_idx" ON "UnitRequest"("status", "dueDate");

-- CreateIndex
CREATE INDEX "RequestComment_requestId_idx" ON "RequestComment"("requestId");

-- CreateIndex
CREATE INDEX "RequestComment_authorId_idx" ON "RequestComment"("authorId");

-- CreateIndex
CREATE INDEX "RequestAttachment_requestId_idx" ON "RequestAttachment"("requestId");

-- CreateIndex
CREATE INDEX "RequestAuditEvent_requestId_idx" ON "RequestAuditEvent"("requestId");

-- CreateIndex
CREATE INDEX "RequestAuditEvent_createdAt_idx" ON "RequestAuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "UnitRequest" ADD CONSTRAINT "UnitRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitRequest" ADD CONSTRAINT "UnitRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitRequest" ADD CONSTRAINT "UnitRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitRequest" ADD CONSTRAINT "UnitRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitRequest" ADD CONSTRAINT "UnitRequest_engineeringApprovalId_fkey" FOREIGN KEY ("engineeringApprovalId") REFERENCES "UnitEngineeringApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestComment" ADD CONSTRAINT "RequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "UnitRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestComment" ADD CONSTRAINT "RequestComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAttachment" ADD CONSTRAINT "RequestAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "UnitRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAttachment" ADD CONSTRAINT "RequestAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAuditEvent" ADD CONSTRAINT "RequestAuditEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "UnitRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAuditEvent" ADD CONSTRAINT "RequestAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
