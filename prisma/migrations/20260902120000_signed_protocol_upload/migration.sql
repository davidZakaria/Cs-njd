-- Signed handover protocol document storage on ContractWorkflow
ALTER TABLE "ContractWorkflow"
  ADD COLUMN "signedProtocolStoredName" TEXT,
  ADD COLUMN "signedProtocolOriginalName" TEXT,
  ADD COLUMN "signedProtocolMimeType" TEXT,
  ADD COLUMN "signedProtocolSizeBytes" INTEGER,
  ADD COLUMN "signedProtocolUploadedAt" TIMESTAMP(3),
  ADD COLUMN "signedProtocolUploadedById" TEXT;
