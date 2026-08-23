-- CreateEnum
CREATE TYPE "PendingParty" AS ENUM (
  'CLIENT',
  'ENGINEERING',
  'LEGAL',
  'FINANCE',
  'MANAGEMENT',
  'LOGISTICS',
  'NONE'
);

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "pendingParty" "PendingParty" DEFAULT 'NONE',
ADD COLUMN "nextFollowUpDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ContractWorkflow" ADD COLUMN "hasSignedProtocol" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasSignedExtension" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasPaidFees" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "papersReceived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Ticket_pendingParty_idx" ON "Ticket"("pendingParty");

-- CreateIndex
CREATE INDEX "Ticket_nextFollowUpDate_idx" ON "Ticket"("nextFollowUpDate");
