-- CreateEnum
CREATE TYPE "FinishingPackage" AS ENUM ('LESS_THAN_COMPANY', 'COMPANY_PACKAGE', 'PACKAGE_1', 'PACKAGE_2', 'PACKAGE_3', 'PACKAGE_4', 'THREE_QUARTERS', 'CORE_AND_SHELL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExecutingCompany" AS ENUM ('NJD', 'GERGES_YOUSSEF', 'OTHER');

-- AlterTable
ALTER TABLE "Finishing" ADD COLUMN     "packageType" "FinishingPackage",
ADD COLUMN     "executingCompany" "ExecutingCompany",
ADD COLUMN     "contractDate" TIMESTAMP(3),
ADD COLUMN     "datedAt" TIMESTAMP(3),
ADD COLUMN     "emailDate" TIMESTAMP(3);
