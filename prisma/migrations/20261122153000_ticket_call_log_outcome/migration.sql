-- CreateEnum
CREATE TYPE "CallLogOutcome" AS ENUM ('ANSWERED', 'NO_ANSWER', 'OTHER');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "callLogOutcome" "CallLogOutcome";