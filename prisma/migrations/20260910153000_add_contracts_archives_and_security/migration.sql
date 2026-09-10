-- AlterTable
ALTER TABLE "ContractWorkflow" ADD COLUMN "signedContractFile" TEXT,
ADD COLUMN "extensionAnnexFile" TEXT;

-- AlterTable
ALTER TABLE "Finishing" ADD COLUMN "finishingContractFile" TEXT;
