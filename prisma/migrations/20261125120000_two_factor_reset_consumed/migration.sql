-- AlterEnum
BEGIN;
CREATE TYPE "AuditAction_new" AS ENUM (
  'CREATE',
  'UPDATE',
  'DELETE',
  'TWO_FACTOR_RESET',
  'PASSWORD_CHANGE',
  'SESSION_REVOKE',
  'EXPORT',
  'TWO_FACTOR_RESET_REQUEST',
  'TWO_FACTOR_RESET_APPROVE',
  'TWO_FACTOR_RESET_DECLINE',
  'TWO_FACTOR_SECRET_ROTATE',
  'TWO_FACTOR_ENROLL'
);
ALTER TABLE "AuditLog" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "AuditAction_old";
COMMIT;

-- AlterTable
ALTER TABLE "TwoFactorResetRequest" ADD COLUMN "usedAt" TIMESTAMP(3);

CREATE INDEX "TwoFactorResetRequest_userId_status_usedAt_idx" ON "TwoFactorResetRequest"("userId", "status", "usedAt");