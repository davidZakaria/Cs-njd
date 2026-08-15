-- CreateEnum
CREATE TYPE "BackupSource" AS ENUM ('MANUAL', 'SCHEDULED');

-- AlterTable
ALTER TABLE "BackupLog" ADD COLUMN "source" "BackupSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "BackupLog" ADD COLUMN "manifest" JSONB;
