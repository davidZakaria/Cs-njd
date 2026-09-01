import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/prisma/soft-delete";
import { CANONICAL_PROJECTS, PROJECT_SLUGS, type CanonicalProject } from "@/lib/projects";

/** Re-enable when finishing import data is complete for executive reporting. */
export const EXECUTIVE_FINANCIALS_ENABLED = true;

export type ProjectFinancialTotals = {
  project: string;
  slug: string;
  totalFinishingPrice: number;
  doorFees: number;
  aluminumFees: number;
  unitCount: number;
};

export type ExecutiveFinancials = {
  byProject: ProjectFinancialTotals[];
  grandTotal: {
    totalFinishingPrice: number;
    doorFees: number;
    aluminumFees: number;
    unitCount: number;
  };
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
          project: { select: { name: true } },
        },
      },
    },
  });

  const byProjectMap = new Map<string, ProjectFinancialTotals>();

  for (const finishing of finishings) {
    const projectName = finishing.unit.project.name;
    const existing = byProjectMap.get(projectName) ?? {
      project: projectName,
      slug: projectSlug(projectName),
      totalFinishingPrice: 0,
      doorFees: 0,
      aluminumFees: 0,
      unitCount: 0,
    };

    existing.totalFinishingPrice = sumField(
      finishing.totalFinishingPrice,
      existing.totalFinishingPrice
    );
    existing.doorFees = sumField(finishing.doorFees, existing.doorFees);
    existing.aluminumFees = sumField(finishing.aluminumFees, existing.aluminumFees);
    existing.unitCount += 1;

    byProjectMap.set(projectName, existing);
  }

  const orderedNames = [
    ...CANONICAL_PROJECTS.filter((name) => byProjectMap.has(name)),
    ...[...byProjectMap.keys()]
      .filter((name) => !(CANONICAL_PROJECTS as readonly string[]).includes(name))
      .sort(),
  ];

  const byProject = orderedNames.map(
    (name) => byProjectMap.get(name)!
  );

  const grandTotal = byProject.reduce(
    (acc, row) => ({
      totalFinishingPrice:
        acc.totalFinishingPrice + row.totalFinishingPrice,
      doorFees: acc.doorFees + row.doorFees,
      aluminumFees: acc.aluminumFees + row.aluminumFees,
      unitCount: acc.unitCount + row.unitCount,
    }),
    {
      totalFinishingPrice: 0,
      doorFees: 0,
      aluminumFees: 0,
      unitCount: 0,
    }
  );

  return { byProject, grandTotal };
}
