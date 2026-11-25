-- Persist selected official handover master variant on text drafts (Green Avenue / Jura).
ALTER TABLE "OfficialDocumentTextDraft" ADD COLUMN "handoverTemplateKey" TEXT;
