import type { AuditAction } from "@prisma/client";

import { auditContext } from "@/lib/prisma/audit-context";
import { basePrisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/prisma/record-audit-log";

export async function recordTwoFactorFlowAudit(
  action: AuditAction,
  recordId: string,
  newData?: object,
  oldData?: object,
  model: "TwoFactorResetRequest" | "User" = "TwoFactorResetRequest"
) {
  const ctx = auditContext.getStore();
  if (!ctx?.userId) return;

  await recordAuditLog(basePrisma, ctx, {
    model,
    action,
    recordId,
    oldData,
    newData,
  });
}