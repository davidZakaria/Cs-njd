-- CreateEnum
CREATE TYPE "OfficialDocumentType" AS ENUM ('GRACE_PERIOD_ANNEX', 'CONTRACT_AMENDMENT', 'HANDOVER_RECORD', 'FINISHING_CONTRACT_SUMMARY', 'UNIT_SWAP_ADDENDUM');

-- CreateTable
CREATE TABLE "OfficialDocumentTemplate" (
    "id" TEXT NOT NULL,
    "documentType" "OfficialDocumentType" NOT NULL,
    "locale" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficialDocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitGeneratedDocument" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitRequestId" TEXT,
    "documentType" "OfficialDocumentType" NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "templateLocale" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "signedCopyOnFileAt" TIMESTAMP(3),
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitGeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialDocumentAuditEvent" (
    "id" TEXT NOT NULL,
    "unitId" TEXT,
    "documentType" "OfficialDocumentType",
    "templateVersion" INTEGER,
    "templateLocale" TEXT,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficialDocumentAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficialDocumentTemplate_documentType_locale_version_key" ON "OfficialDocumentTemplate"("documentType", "locale", "version");

-- CreateIndex
CREATE INDEX "OfficialDocumentTemplate_documentType_locale_isActive_idx" ON "OfficialDocumentTemplate"("documentType", "locale", "isActive");

-- CreateIndex
CREATE INDEX "UnitGeneratedDocument_unitId_generatedAt_idx" ON "UnitGeneratedDocument"("unitId", "generatedAt");

-- CreateIndex
CREATE INDEX "UnitGeneratedDocument_unitRequestId_idx" ON "UnitGeneratedDocument"("unitRequestId");

-- CreateIndex
CREATE INDEX "UnitGeneratedDocument_documentType_idx" ON "UnitGeneratedDocument"("documentType");

-- CreateIndex
CREATE INDEX "OfficialDocumentAuditEvent_unitId_idx" ON "OfficialDocumentAuditEvent"("unitId");

-- CreateIndex
CREATE INDEX "OfficialDocumentAuditEvent_createdAt_idx" ON "OfficialDocumentAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "OfficialDocumentAuditEvent_documentType_idx" ON "OfficialDocumentAuditEvent"("documentType");

-- AddForeignKey
ALTER TABLE "OfficialDocumentTemplate" ADD CONSTRAINT "OfficialDocumentTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitGeneratedDocument" ADD CONSTRAINT "UnitGeneratedDocument_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitGeneratedDocument" ADD CONSTRAINT "UnitGeneratedDocument_unitRequestId_fkey" FOREIGN KEY ("unitRequestId") REFERENCES "UnitRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitGeneratedDocument" ADD CONSTRAINT "UnitGeneratedDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OfficialDocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitGeneratedDocument" ADD CONSTRAINT "UnitGeneratedDocument_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialDocumentAuditEvent" ADD CONSTRAINT "OfficialDocumentAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
