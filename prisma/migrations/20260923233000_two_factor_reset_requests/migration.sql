-- CreateEnum
CREATE TYPE "TwoFactorResetRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "TwoFactorResetRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TwoFactorResetRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "TwoFactorResetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TwoFactorResetRequest_userId_status_idx" ON "TwoFactorResetRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "TwoFactorResetRequest_status_requestedAt_idx" ON "TwoFactorResetRequest"("status", "requestedAt");

-- AddForeignKey
ALTER TABLE "TwoFactorResetRequest" ADD CONSTRAINT "TwoFactorResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorResetRequest" ADD CONSTRAINT "TwoFactorResetRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
