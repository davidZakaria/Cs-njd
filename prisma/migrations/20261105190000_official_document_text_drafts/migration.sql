-- Editable official document text drafts (versioned) before PDF generation
CREATE TABLE "OfficialDocumentTextDraft" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitRequestId" TEXT,
    "documentType" "OfficialDocumentType" NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "templateLocale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currentBody" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialDocumentTextDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfficialDocumentTextDraftVersion" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficialDocumentTextDraftVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UnitGeneratedDocument" ADD COLUMN "textDraftId" TEXT;
ALTER TABLE "UnitGeneratedDocument" ADD COLUMN "textDraftVersionId" TEXT;

CREATE INDEX "OfficialDocumentTextDraft_unitId_updatedAt_idx" ON "OfficialDocumentTextDraft"("unitId", "updatedAt");
CREATE INDEX "OfficialDocumentTextDraftVersion_draftId_createdAt_idx" ON "OfficialDocumentTextDraftVersion"("draftId", "createdAt");

ALTER TABLE "OfficialDocumentTextDraft" ADD CONSTRAINT "OfficialDocumentTextDraft_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfficialDocumentTextDraft" ADD CONSTRAINT "OfficialDocumentTextDraft_unitRequestId_fkey" FOREIGN KEY ("unitRequestId") REFERENCES "UnitRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfficialDocumentTextDraft" ADD CONSTRAINT "OfficialDocumentTextDraft_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OfficialDocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficialDocumentTextDraft" ADD CONSTRAINT "OfficialDocumentTextDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfficialDocumentTextDraft" ADD CONSTRAINT "OfficialDocumentTextDraft_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfficialDocumentTextDraftVersion" ADD CONSTRAINT "OfficialDocumentTextDraftVersion_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "OfficialDocumentTextDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfficialDocumentTextDraftVersion" ADD CONSTRAINT "OfficialDocumentTextDraftVersion_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UnitGeneratedDocument" ADD CONSTRAINT "UnitGeneratedDocument_textDraftId_fkey" FOREIGN KEY ("textDraftId") REFERENCES "OfficialDocumentTextDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UnitGeneratedDocument" ADD CONSTRAINT "UnitGeneratedDocument_textDraftVersionId_fkey" FOREIGN KEY ("textDraftVersionId") REFERENCES "OfficialDocumentTextDraftVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "UnitGeneratedDocument_textDraftId_idx" ON "UnitGeneratedDocument"("textDraftId");
