import { prisma } from "@/lib/prisma";
import { activeContractWorkflowWhere, activeUnitWhere } from "@/lib/prisma";
import {
  DELIVERED_HANDOVER_STATUSES,
} from "@/lib/executive/handover-status-groups";
import { projectNameToSlug } from "@/lib/cases/cases-filter-url";

export type ExecutiveProjectUnitSummary = {
  projectId: string;
  projectName: string;
  slug: string;
  totalUnits: number;
  unassignedUnits: number;
  deliveredUnits: number;
  deliveryOverdue: number;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getExecutiveProjectUnitSummaries(): Promise<
  ExecutiveProjectUnitSummary[]
> {
  const todayStart = startOfDay(new Date());
  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return Promise.all(
    projects.map(async (project) => {
      const unitScope = { projectId: project.id };
      const [totalUnits, unassignedUnits, deliveredUnits, deliveryOverdue] =
        await Promise.all([
          prisma.unit.count({ where: activeUnitWhere(unitScope) }),
          prisma.unit.count({
            where: activeUnitWhere({ ...unitScope, agentId: null }),
          }),
          prisma.contractWorkflow.count({
            where: activeContractWorkflowWhere({
              unit: unitScope,
              handoverStatus: { in: [...DELIVERED_HANDOVER_STATUSES] },
            }),
          }),
          prisma.contractWorkflow.count({
            where: activeContractWorkflowWhere({
              unit: unitScope,
              deliveryDate: { lt: todayStart },
              handoverStatus: { notIn: [...DELIVERED_HANDOVER_STATUSES] },
            }),
          }),
        ]);

      return {
        projectId: project.id,
        projectName: project.name,
        slug: projectNameToSlug(project.name),
        totalUnits,
        unassignedUnits,
        deliveredUnits,
        deliveryOverdue,
      };
    })
  );
}
