import type { AuditAction, PrismaClient } from "@prisma/client";

import { redactAuditData } from "@/lib/audit/redact-secrets";
import type { AuditContextStore } from "@/lib/prisma/audit-context";

export async function recordAuditLog(
  auditLogClient: PrismaClient,
  ctx: AuditContextStore,
  params: {
    model: string;
    action: AuditAction;
    recordId: string;
    oldData?: object;
    newData?: object;
  }
): Promise<void> {
  if (!ctx.userId) return;

  const { oldData, newData } = redactAuditData(params.oldData, params.newData);

  await auditLogClient.auditLog.create({
    data: {
      userId: ctx.userId,
      action: params.action,
      tableName: params.model,
      recordId: params.recordId,
      oldData,
      newData,
      ipAddress: ctx.ipAddress,
    },
  });
}
