import "server-only";

import type { PrismaClient } from "@prisma/client";

import { recordRequestAuditEvent } from "@/lib/requests/audit";
import { isRequestOverdue } from "@/lib/requests/overdue";
import type { UnitRequestListRow } from "@/lib/requests/types";
import { notifyRoles } from "@/lib/services/notifications";

export type RequestEscalationDb = Pick<PrismaClient, "unitRequest">;

const listInclude = {
  requestedBy: { select: { id: true, name: true } },
  unit: {
    select: {
      id: true,
      unitCode: true,
      agentId: true,
      project: { select: { name: true } },
      client: { select: { name: true } },
    },
  },
} as const;

export async function getOverduePendingRequests(
  prisma: RequestEscalationDb,
  limit: number
): Promise<UnitRequestListRow[]> {
  const now = new Date();
  const rows = await prisma.unitRequest.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now },
    },
    take: limit,
    orderBy: { dueDate: "asc" },
    include: listInclude,
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    dueDate: row.dueDate,
    submittedAt: row.submittedAt,
    currentApproverKind: row.currentApproverKind,
    escalatedToManagement: row.escalatedToManagement,
    requestedById: row.requestedById,
    requestedByName: row.requestedBy.name,
    unitId: row.unit.id,
    unitCode: row.unit.unitCode,
    projectName: row.unit.project.name,
    clientName: row.unit.client?.name ?? "—",
    unitAgentId: row.unit.agentId,
    unitCycleStageKey: row.unitCycleStageKey,
  }));
}

export async function runRequestEscalationJob(
  prisma: RequestEscalationDb
): Promise<{ notified: number; scanned: number }> {
  const ESCALATION_COOLDOWN_MS = 20 * 60 * 60 * 1000;
  const overdue = await getOverduePendingRequests(prisma, 500);
  const now = new Date();
  let notified = 0;

  for (const row of overdue) {
    if (!isRequestOverdue({ status: row.status, dueDate: row.dueDate, now })) {
      continue;
    }

    const record = await prisma.unitRequest.findUnique({
      where: { id: row.id },
      select: { lastEscalatedAt: true },
    });
    if (
      record?.lastEscalatedAt &&
      now.getTime() - record.lastEscalatedAt.getTime() < ESCALATION_COOLDOWN_MS
    ) {
      continue;
    }

    await notifyRoles(
      ["MANAGEMENT", "SUPER_ADMIN"],
      "Overdue unit request",
      "طلب وحدة متأخر",
      `${row.projectName} · ${row.unitCode} · ${row.type}`,
      `${row.projectName} · ${row.unitCode} · ${row.type}`,
      `/requests/${row.id}`
    );

    await prisma.unitRequest.update({
      where: { id: row.id },
      data: {
        escalatedToManagement: true,
        lastEscalatedAt: now,
        currentApproverKind: "MANAGEMENT",
      },
    });

    await recordRequestAuditEvent({
      requestId: row.id,
      action: "escalated_overdue",
      details: {
        daysOverdue: row.dueDate
          ? Math.floor((now.getTime() - row.dueDate.getTime()) / 86400000)
          : 0,
      },
    });

    notified += 1;
  }

  return { notified, scanned: overdue.length };
}

export function getRequestEscalationCronSchedule(): string {
  return (
    process.env.REQUEST_ESCALATION_CRON ??
    process.env.UNIT_CYCLE_CRON ??
    "0 8 * * *"
  );
}
