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
  pricedUnitCount: number;
  doorFeesUnitCount: number;
  aluminumFeesUnitCount: number;
  noFinishingDataCount: number;
  flaggedUnitCount: number;
};

export type FlaggedFinishingUnit = {
  unitId: string;
  unitCode: string;
  project: string;
  slug: string;
  area: number | null;
  pricePerMeter: number | null;
  totalFinishingPrice: number | null;
  doorFees: number | null;
  aluminumFees: number | null;
  reasons: FinishingDataQualityReason[];
  includeTotalInSum: boolean;
  includeDoorInSum: boolean;
  includeAluminumInSum: boolean;
};

export type ExecutiveFinancials = {
  byProject: ProjectFinancialTotals[];
  grandTotal: {
    totalFinishingPrice: number;
    doorFees: number;
    aluminumFees: number;
    pricedUnitCount: number;
    doorFeesUnitCount: number;
    aluminumFeesUnitCount: number;
    noFinishingDataCount: number;
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

function emptyProjectTotals(projectName: string): ProjectFinancialTotals {
  return {
    project: projectName,
    slug: projectSlug(projectName),
    totalFinishingPrice: 0,
    doorFees: 0,
    aluminumFees: 0,
    pricedUnitCount: 0,
    doorFeesUnitCount: 0,
    aluminumFeesUnitCount: 0,
    noFinishingDataCount: 0,
    flaggedUnitCount: 0,
  };
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
      pricePerMeter: true,
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
    const assessment = assessFinishingFinancialData({
      totalFinishingPrice: finishing.totalFinishingPrice,
      doorFees: finishing.doorFees,
      aluminumFees: finishing.aluminumFees,
      area: finishing.unit.area,
      pricePerMeter: finishing.pricePerMeter,
    });

    const existing =
      byProjectMap.get(projectName) ?? emptyProjectTotals(projectName);

    if (assessment.isEmpty) {
      existing.noFinishingDataCount += 1;
      byProjectMap.set(projectName, existing);
      continue;
    }

    if (assessment.showInFinanceDataCheck) {
      existing.flaggedUnitCount += 1;
      flaggedUnits.push({
        unitId: finishing.unit.id,
        unitCode: finishing.unit.unitCode,
        project: projectName,
        slug: projectSlug(projectName),
        area: finishing.unit.area,
        pricePerMeter: finishing.pricePerMeter,
        totalFinishingPrice: finishing.totalFinishingPrice,
        doorFees: finishing.doorFees,
        aluminumFees: finishing.aluminumFees,
        reasons: assessment.financeCheckReasons,
        includeTotalInSum: assessment.includeTotalInSum,
        includeDoorInSum: assessment.includeDoorInSum,
        includeAluminumInSum: assessment.includeAluminumInSum,
      });
    }

    if (assessment.includeTotalInSum) {
      existing.totalFinishingPrice = sumField(
        finishing.totalFinishingPrice,
        existing.totalFinishingPrice
      );
      existing.pricedUnitCount += 1;
    }
    if (assessment.includeDoorInSum) {
      existing.doorFees = sumField(finishing.doorFees, existing.doorFees);
      existing.doorFeesUnitCount += 1;
    }
    if (assessment.includeAluminumInSum) {
      existing.aluminumFees = sumField(
        finishing.aluminumFees,
        existing.aluminumFees
      );
      existing.aluminumFeesUnitCount += 1;
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
      doorFeesUnitCount: acc.doorFeesUnitCount + row.doorFeesUnitCount,
      aluminumFeesUnitCount:
        acc.aluminumFeesUnitCount + row.aluminumFeesUnitCount,
      noFinishingDataCount: acc.noFinishingDataCount + row.noFinishingDataCount,
      flaggedUnitCount: acc.flaggedUnitCount + row.flaggedUnitCount,
    }),
    {
      totalFinishingPrice: 0,
      doorFees: 0,
      aluminumFees: 0,
      pricedUnitCount: 0,
      doorFeesUnitCount: 0,
      aluminumFeesUnitCount: 0,
      noFinishingDataCount: 0,
      flaggedUnitCount: 0,
    }
  );

  return { byProject, grandTotal, flaggedUnits };
}
