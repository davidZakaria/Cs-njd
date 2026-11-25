-- Persist handover master variant on text drafts.
-- Fresh installs: column is created in 20261105190000_official_document_text_drafts.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'OfficialDocumentTextDraft'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
  WHERE table_schema = 'public'
      AND table_name = 'OfficialDocumentTextDraft'
      AND column_name = 'handoverTemplateKey'
  ) THEN
    ALTER TABLE "OfficialDocumentTextDraft" ADD COLUMN "handoverTemplateKey" TEXT;
  END IF;
END $$;