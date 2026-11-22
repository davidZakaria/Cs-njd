import { prisma, activeUnitWhere } from "@/lib/prisma";

export type MultiUnitBadgeData = {
  unitCount: number;
  otherUnits: Array<{ id: string; unitCode: string; projectName: string }>;
};

/**
 * Check if a client owns multiple units (including co-ownership).
 * Returns badge data if the client owns 2+ units, null otherwise.
 * 
 * Client matching is by client record ID (dedupe happens at client level).
 * If the same person appears as separate Client records (e.g., imported twice
 * with different phones), they appear as separate clients.
 */
export async function getMultiUnitBadgeData(
  clientIds: string[],
  currentUnitId: string
): Promise<MultiUnitBadgeData | null> {
  if (clientIds.length === 0) return null;

  const otherUnits = await prisma.unit.findMany({
    where: activeUnitWhere({
      id: { not: currentUnitId },
      OR: [
        { clientId: { in: clientIds } },
        { unitClients: { some: { clientId: { in: clientIds } } } },
      ],
    }),
    select: {
      id: true,
      unitCode: true,
      project: { select: { name: true } },
    },
    orderBy: [{ project: { name: "asc" } }, { unitCode: "asc" }],
    take: 10,
  });

  if (otherUnits.length === 0) return null;

  return {
    unitCount: otherUnits.length + 1,
    otherUnits: otherUnits.map((u) => ({
      id: u.id,
      unitCode: u.unitCode,
      projectName: u.project.name,
    })),
  };
}
