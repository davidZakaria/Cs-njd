import { prisma } from "@/lib/prisma";

export type AuditRecordLabelInput = {
  tableName: string;
  recordId: string;
};

function labelKey(tableName: string, recordId: string): string {
  return `${tableName}\0${recordId}`;
}

const STATIC_LABELS: Record<string, { en: string; ar: string }> = {
  "AuditLog\0filtered-export": {
    en: "Filtered export",
    ar: "تصدير مُصفّى",
  },
};

export async function resolveAuditRecordLabels(
  entries: AuditRecordLabelInput[],
  locale: "en" | "ar"
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  for (const entry of entries) {
    const key = labelKey(entry.tableName, entry.recordId);
    const staticLabel = STATIC_LABELS[key];
    if (staticLabel) {
      out.set(key, staticLabel[locale]);
    }
  }

  const byTable = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (STATIC_LABELS[labelKey(entry.tableName, entry.recordId)]) continue;
    const set = byTable.get(entry.tableName) ?? new Set<string>();
    set.add(entry.recordId);
    byTable.set(entry.tableName, set);
  }

  const clientIds = [...(byTable.get("Client") ?? [])];
  if (clientIds.length) {
    const rows = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    });
    for (const row of rows) {
      out.set(labelKey("Client", row.id), row.name);
    }
  }

  const userIds = [...(byTable.get("User") ?? [])];
  if (userIds.length) {
    const rows = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    for (const row of rows) {
      out.set(labelKey("User", row.id), row.name);
    }
  }

  const unitIds = [...(byTable.get("Unit") ?? [])];
  if (unitIds.length) {
    const rows = await prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, unitCode: true },
    });
    for (const row of rows) {
      out.set(labelKey("Unit", row.id), row.unitCode);
    }
  }

  const ticketIds = [...(byTable.get("Ticket") ?? [])];
  if (ticketIds.length) {
    const rows = await prisma.ticket.findMany({
      where: { id: { in: ticketIds } },
      select: {
        id: true,
        unit: { select: { unitCode: true } },
      },
    });
    for (const row of rows) {
      const code = row.unit?.unitCode ?? row.id.slice(0, 8);
      out.set(
        labelKey("Ticket", row.id),
        locale === "ar" ? `بلاغ · ${code}` : `Case · ${code}`
      );
    }
  }

  const finishingIds = [...(byTable.get("Finishing") ?? [])];
  if (finishingIds.length) {
    const rows = await prisma.finishing.findMany({
      where: { id: { in: finishingIds } },
      select: {
        id: true,
        unit: { select: { unitCode: true } },
      },
    });
    for (const row of rows) {
      const code = row.unit?.unitCode ?? row.id.slice(0, 8);
      out.set(
        labelKey("Finishing", row.id),
        locale === "ar" ? `تشطيب · ${code}` : `Finishing · ${code}`
      );
    }
  }

  const workflowIds = [...(byTable.get("ContractWorkflow") ?? [])];
  if (workflowIds.length) {
    const rows = await prisma.contractWorkflow.findMany({
      where: { id: { in: workflowIds } },
      select: {
        id: true,
        unit: { select: { unitCode: true } },
      },
    });
    for (const row of rows) {
      const code = row.unit?.unitCode ?? row.id.slice(0, 8);
      out.set(labelKey("ContractWorkflow", row.id), code);
    }
  }

  return out;
}

export function getAuditRecordLabel(
  labels: Map<string, string>,
  tableName: string,
  recordId: string
): string | null {
  return labels.get(labelKey(tableName, recordId)) ?? null;
}