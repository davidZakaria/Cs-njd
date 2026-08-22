-- Soft deletes
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Unit" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Finishing" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ContractWorkflow" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "Client_deletedAt_idx" ON "Client"("deletedAt");
CREATE INDEX "Unit_deletedAt_idx" ON "Unit"("deletedAt");
CREATE INDEX "Ticket_deletedAt_idx" ON "Ticket"("deletedAt");
CREATE INDEX "Finishing_deletedAt_idx" ON "Finishing"("deletedAt");
CREATE INDEX "ContractWorkflow_deletedAt_idx" ON "ContractWorkflow"("deletedAt");

-- In-app notifications
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
