import { prisma } from "@/lib/prisma";
import { activeUnitWhere } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  type UnitDashboardRow,
  mapUnitToDashboardRow,
  countUnitDashboardRows,
  startOfDay,
} from "@/lib/units/unit-dashboard-filters";
import { unitWhereForDashboardFilters } from "@/lib/units/unit-dashboard-where.server";
import type { UnitsPageFilters } from "@/lib/units/units-filter-url";

export async function countUnitsForDashboardFilters(
  filters: UnitsPageFilters,
  options?: { unitScope?: Prisma.UnitWhereInput; todayStart?: Date }
): Promise<number> {
  const where = unitWhereForDashboardFilters(filters, options);
  return prisma.unit.count({ where });
}

export async function loadUnitDashboardRows(
  unitScope: Prisma.UnitWhereInput = {}
) {
  const units = await prisma.unit.findMany({
    where: activeUnitWhere(unitScope),
    include: {
      project: true,
      agent: true,
      contractWorkflow: { where: { deletedAt: null } },
      finishing: { select: { doorFees: true, aluminumFees: true } },
    },
  });
  return units.map(mapUnitToDashboardRow);
}

export function countLoadedUnitRows(
  rows: UnitDashboardRow[],
  filters: UnitsPageFilters,
  todayStart = startOfDay(new Date())
) {
  return countUnitDashboardRows(rows, filters, todayStart);
}