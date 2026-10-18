-- Additive: activity feed notifications vs general inbox items.
CREATE TYPE "NotificationKind" AS ENUM ('GENERAL', 'ACTIVITY');

ALTER TABLE "Notification" ADD COLUMN "kind" "NotificationKind" NOT NULL DEFAULT 'GENERAL';

CREATE INDEX "Notification_userId_kind_isRead_idx" ON "Notification"("userId", "kind", "isRead");
