import type { AuditAction, PrismaClient } from "@prisma/client";

import type { AuditContextStore } from "@/lib/prisma/audit-context";
import { recordAuditLog } from "@/lib/prisma/record-audit-log";
import { isSoftDeleteModel, mergeNotDeleted } from "@/lib/prisma/soft-delete";

type RowWithId = { id: string } & Record<string, unknown>;

function whereForModel(
  model: string,
  where: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (isSoftDeleteModel(model)) {
    return mergeNotDeleted(where);
  }
  return where ?? {};
}

export async function recordDeleteManyAudits(
  delegate: {
    findMany: (args: {
      where: Record<string, unknown>;
    }) => Promise<RowWithId[]>;
  },
  auditLogClient: PrismaClient,
  ctx: AuditContextStore,
  model: string,
  where: Record<string, unknown> | undefined
): Promise<void> {
  const rows = await delegate.findMany({
    where: whereForModel(model, where),
  });

  for (const row of rows) {
    await recordAuditLog(auditLogClient, ctx, {
      model,
      action: "DELETE",
      recordId: String(row.id),
      oldData: row as object,
    });
  }
}

export async function fetchRowsForBulkWhere(
  delegate: {
    findMany: (args: {
      where: Record<string, unknown>;
    }) => Promise<RowWithId[]>;
  },
  model: string,
  where: Record<string, unknown> | undefined
): Promise<RowWithId[]> {
  return delegate.findMany({
    where: whereForModel(model, where),
  });
}

export async function recordUpdateManyAudits(
  delegate: {
    findMany: (args: {
      where: Record<string, unknown>;
    }) => Promise<RowWithId[]>;
  },
  auditLogClient: PrismaClient,
  ctx: AuditContextStore,
  model: string,
  beforeRows: RowWithId[]
): Promise<void> {
  if (!beforeRows.length) return;

  const ids = beforeRows.map((row) => row.id);
  const afterRows = await delegate.findMany({
    where: { id: { in: ids } },
  });
  const afterById = new Map(afterRows.map((row) => [row.id, row]));

  for (const row of beforeRows) {
    const next = afterById.get(row.id);
    await recordAuditLog(auditLogClient, ctx, {
      model,
      action: "UPDATE",
      recordId: String(row.id),
      oldData: row as object,
      newData: (next ?? row) as object,
    });
  }
}

export async function recordCreateManyAndReturnAudits(
  auditLogClient: PrismaClient,
  ctx: AuditContextStore,
  model: string,
  rows: RowWithId[]
): Promise<void> {
  for (const row of rows) {
    await recordAuditLog(auditLogClient, ctx, {
      model,
      action: "CREATE",
      recordId: String(row.id),
      newData: row as object,
    });
  }
}

export function singleMutationAction(
  operation: string,
  model: string,
  hadExistingRow: boolean
): AuditAction {
  const actionMap: Record<string, AuditAction> = {
    create: "CREATE",
    update: "UPDATE",
    delete: "DELETE",
    upsert: hadExistingRow ? "UPDATE" : "CREATE",
  };

  if (operation === "delete" && isSoftDeleteModel(model)) {
    return "UPDATE";
  }

  return actionMap[operation] ?? "UPDATE";
}
