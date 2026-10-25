import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/prisma/soft-delete";
import { CANONICAL_PROJECTS, PROJECT_SLUGS, type CanonicalProject } from "@/lib/projects";
import {
  assessFinishingFinancialData,
  type FinishingDataQualityReason,
} from "@/lib/finishing/financial-data-quality";

/** Re-enable when finishing import data is complete for executive reporting. */
export const EXECUTIVE_FINANCIALS_ENABLED = true;

export type ProjectFinancialTotals = {
  project: string;
  slug: string;
  totalFinishingPrice: number;
  doorFees: number;
  aluminumFees: number;
  /** Units included in summed totals (clean or priced-without-area only). */
  pricedUnitCount: number;
  flaggedUnitCount: number;
};

export type FlaggedFinishingUnit = {
  unitId: string;
  unitCode: string;
  project: string;
  slug: string;
  area: number | null;
  totalFinishingPrice: number | null;
  doorFees: number | null;
  aluminumFees: number | null;
  reasons: FinishingDataQualityReason[];
  excludeFromTotals: boolean;
};

export type ExecutiveFinancials = {
  byProject: ProjectFinancialTotals[];
  grandTotal: {
    totalFinishingPrice: number;
    doorFees: number;
    aluminumFees: number;
    pricedUnitCount: number;
    flaggedUnitCount: number;
  };
  flaggedUnits: FlaggedFinishingUnit[];
};

function sumField(value: number | null | undefined, acc: number) {
  return acc + (value ?? 0);
}

function projectSlug(name: string): string {
  if ((CANONICAL_PROJECTS as readonly string[]).includes(name)) {
    return PROJECT_SLUGS[name as CanonicalProject];
  }
  return name.toLowerCase().replace(/\s+/g, "-");
}

export async function getExecutiveFinancials(): Promise<ExecutiveFinancials> {
  const finishings = await prisma.finishing.findMany({
    where: {
      ...notDeleted,
      unit: notDeleted,
    },
    select: {
      totalFinishingPrice: true,
      doorFees: true,
      aluminumFees: true,
      unit: {
        select: {
          id: true,
          unitCode: true,
          area: true,
          project: { select: { name: true } },
        },
      },
    },
  });

  const byProjectMap = new Map<string, ProjectFinancialTotals>();
  const flaggedUnits: FlaggedFinishingUnit[] = [];

  for (const finishing of finishings) {
    const projectName = finishing.unit.project.name;
    const quality = assessFinishingFinancialData({
      totalFinishingPrice: finishing.totalFinishingPrice,
      doorFees: finishing.doorFees,
      aluminumFees: finishing.aluminumFees,
      area: finishing.unit.area,
    });

    const existing = byProjectMap.get(projectName) ?? {
      project: projectName,
      slug: projectSlug(projectName),
      totalFinishingPrice: 0,
      doorFees: 0,
      aluminumFees: 0,
      pricedUnitCount: 0,
      flaggedUnitCount: 0,
    };

    if (quality.flagged) {
      existing.flaggedUnitCount += 1;
      flaggedUnits.push({
        unitId: finishing.unit.id,
        unitCode: finishing.unit.unitCode,
        project: projectName,
        slug: projectSlug(projectName),
        area: finishing.unit.area,
        totalFinishingPrice: finishing.totalFinishingPrice,
        doorFees: finishing.doorFees,
        aluminumFees: finishing.aluminumFees,
        reasons: quality.reasons,
        excludeFromTotals: quality.excludeFromTotals,
      });
    }

    if (!quality.excludeFromTotals) {
      existing.totalFinishingPrice = sumField(
        finishing.totalFinishingPrice,
        existing.totalFinishingPrice
      );
      existing.doorFees = sumField(finishing.doorFees, existing.doorFees);
      existing.aluminumFees = sumField(
        finishing.aluminumFees,
        existing.aluminumFees
      );
      if ((finishing.totalFinishingPrice ?? 0) > 0) {
        existing.pricedUnitCount += 1;
      }
    }

    byProjectMap.set(projectName, existing);
  }

  flaggedUnits.sort((a, b) =>
    a.project.localeCompare(b.project) || a.unitCode.localeCompare(b.unitCode)
  );

  const orderedNames = [
    ...CANONICAL_PROJECTS.filter((name) => byProjectMap.has(name)),
    ...[...byProjectMap.keys()]
      .filter((name) => !(CANONICAL_PROJECTS as readonly string[]).includes(name))
      .sort(),
  ];

  const byProject = orderedNames.map((name) => byProjectMap.get(name)!);

  const grandTotal = byProject.reduce(
    (acc, row) => ({
      totalFinishingPrice:
        acc.totalFinishingPrice + row.totalFinishingPrice,
      doorFees: acc.doorFees + row.doorFees,
      aluminumFees: acc.aluminumFees + row.aluminumFees,
      pricedUnitCount: acc.pricedUnitCount + row.pricedUnitCount,
      flaggedUnitCount: acc.flaggedUnitCount + row.flaggedUnitCount,
    }),
    {
      totalFinishingPrice: 0,
      doorFees: 0,
      aluminumFees: 0,
      pricedUnitCount: 0,
      flaggedUnitCount: 0,
    }
  );

  return { byProject, grandTotal, flaggedUnits };
}
