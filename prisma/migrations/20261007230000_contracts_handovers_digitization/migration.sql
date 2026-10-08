-- Contracts & handovers digitization (additive)
ALTER TABLE "ContractWorkflow" ADD COLUMN "hasPreliminarySaleContract" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractWorkflow" ADD COLUMN "signedProtocolDate" TIMESTAMP(3);
ALTER TABLE "ContractWorkflow" ADD COLUMN "signedExtensionDate" TIMESTAMP(3);
ALTER TABLE "ContractWorkflow" ADD COLUMN "hasFinalSaleContract" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractWorkflow" ADD COLUMN "finalSaleContractDate" TIMESTAMP(3);
ALTER TABLE "ContractWorkflow" ADD COLUMN "siteVisitDone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractWorkflow" ADD COLUMN "siteVisitDate1" TIMESTAMP(3);
ALTER TABLE "ContractWorkflow" ADD COLUMN "siteVisitDate2" TIMESTAMP(3);
ALTER TABLE "ContractWorkflow" ADD COLUMN "siteVisitDate3" TIMESTAMP(3);
ALTER TABLE "ContractWorkflow" ADD COLUMN "clientInspectionNotes" TEXT;
ALTER TABLE "ContractWorkflow" ADD COLUMN "dhlSentToClient" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractWorkflow" ADD COLUMN "dhlSentToClientDate" TIMESTAMP(3);
ALTER TABLE "ContractWorkflow" ADD COLUMN "dhlReceivedFromClient" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractWorkflow" ADD COLUMN "dhlReceivedFromClientDate" TIMESTAMP(3);
ALTER TABLE "ContractWorkflow" ADD COLUMN "paperHandoverPreliminaryCopy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractWorkflow" ADD COLUMN "paperHandoverOriginalProtocol" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractWorkflow" ADD COLUMN "paperHandoverFinishingPapers" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractWorkflow" ADD COLUMN "paperHandoverKeyReceived" BOOLEAN NOT NULL DEFAULT false;

-- Existing contract dates imply preliminary sale contract was recorded
UPDATE "ContractWorkflow"
SET "hasPreliminarySaleContract" = true
WHERE "contractDate" IS NOT NULL;
