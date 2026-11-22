import type { PrismaClient } from "@prisma/client";

import type { UnitRequestListRow } from "@/lib/requests/types";
import { resolvePrimaryClientName } from "@/lib/units/unit-request-search";

export async function loadAllUnitRequestRows(
  prisma: Pick<PrismaClient, "unitRequest">
): Promise<UnitRequestListRow[]> {
  const rows = await prisma.unitRequest.findMany({
    where: { deletedAt: null },
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
          unitClients: {
            where: { role: "PRIMARY" },
            take: 1,
            select: { role: true, client: { select: { name: true } } },
          },
        },
      },
      bulkProject: { select: { name: true } },
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
    assignedApproverUserId: row.assignedApproverUserId,
    requestedById: row.requestedById,
    requestedByName: row.requestedBy.name,
    unitId: row.unit?.id ?? "",
    unitCode: row.unit?.unitCode ?? "—",
    projectName:
      row.unit?.project.name ?? row.bulkProject?.name ?? "—",
    clientName: row.unit
      ? resolvePrimaryClientName({
          client: row.unit.client,
          unitClients: row.unit.unitClients,
        })
      : "—",
    unitAgentId: row.unit?.agentId ?? null,
    unitCycleStageKey: row.unitCycleStageKey,
  }));
}
