-- Soft-remove request attachments (retain files for audit/history)
ALTER TABLE "RequestAttachment" ADD COLUMN "removedAt" TIMESTAMP(3);
ALTER TABLE "RequestAttachment" ADD COLUMN "removedById" TEXT;

ALTER TABLE "RequestAttachment" ADD CONSTRAINT "RequestAttachment_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RequestAttachment_requestId_removedAt_idx" ON "RequestAttachment"("requestId", "removedAt");
