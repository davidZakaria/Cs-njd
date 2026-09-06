-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Ticket_resolvedAt_idx" ON "Ticket"("resolvedAt");

-- CreateIndex
CREATE INDEX "Ticket_status_resolvedAt_idx" ON "Ticket"("status", "resolvedAt");

-- Backfill historical resolved tickets
UPDATE "Ticket"
SET "resolvedAt" = "updatedAt"
WHERE "status" = 'RESOLVED'
  AND "resolvedAt" IS NULL
  AND "deletedAt" IS NULL;
