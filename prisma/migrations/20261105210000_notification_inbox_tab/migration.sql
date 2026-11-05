-- Inbox tabs for /notifications (call logs, requests & files, overdue digests).

CREATE TYPE "NotificationInboxTab" AS ENUM (
  'CALL_LOG',
  'REQUESTS_AND_FILES',
  'OVERDUE_TASKS'
);

ALTER TABLE "Notification"
ADD COLUMN "inboxTab" "NotificationInboxTab",
ADD COLUMN "dedupeKey" TEXT;

UPDATE "Notification"
SET "inboxTab" = 'CALL_LOG'
WHERE "kind" = 'ACTIVITY' AND "inboxTab" IS NULL;

CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key"
ON "Notification"("userId", "dedupeKey");

CREATE INDEX "Notification_userId_inboxTab_isRead_idx"
ON "Notification"("userId", "inboxTab", "isRead");
