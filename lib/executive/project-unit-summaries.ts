import { prisma } from "@/lib/prisma";
import { activeUnitWhere } from "@/lib/prisma";
import { projectNameToSlug } from "@/lib/cases/cases-filter-url";
import { countUnitsForDashboardFilters } from "@/lib/dashboard/unit-metric-counts";
import { startOfDay } from "@/lib/units/unit-dashboard-filters";

export type ExecutiveProjectUnitSummary = {
  projectId: string;
  projectName: string;
  slug: string;
  totalUnits: number;
  unassignedUnits: number;
  deliveredUnits: number;
  deliveryOverdue: number;
};

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
          countUnitsForDashboardFilters(
            {
              handover: "delivered",
              delivery: "all",
              fees: "all",
              signedProtocol: "all",
              agent: "all",
              project: "all",
            },
            { unitScope, todayStart }
          ),
          countUnitsForDashboardFilters(
            {
              handover: "all",
              delivery: "overdue",
              fees: "all",
              signedProtocol: "all",
              agent: "all",
              project: "all",
            },
            { unitScope, todayStart }
          ),
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
