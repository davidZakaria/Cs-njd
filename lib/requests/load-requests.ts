import "server-only";

import type { PrismaClient } from "@prisma/client";

import type { UnitRequestListRow } from "@/lib/requests/types";

export async function loadAllUnitRequestRows(
  prisma: Pick<PrismaClient, "unitRequest">
): Promise<UnitRequestListRow[]> {
  const rows = await prisma.unitRequest.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
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
    },
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
