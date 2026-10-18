"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activeUnitWhere } from "@/lib/prisma";
import { unitMatchesOwnerSearchQuery } from "@/lib/units/unit-owner-search";

export type SpotlightSearchResult = {
  unitId: string;
  unitCode: string;
  clientName: string;
  projectName: string;
};

export async function searchUnitsSpotlight(
  query: string
): Promise<SpotlightSearchResult[]> {
  const session = await auth();
  if (!session?.user) return [];

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const units = await prisma.unit.findMany({
    where: activeUnitWhere(unitMatchesOwnerSearchQuery(trimmed)),
    include: {
      project: { select: { name: true } },
      client: { select: { name: true, phone1: true, phones: { select: { phone: true } } } },
    },
    take: 8,
    orderBy: { updatedAt: "desc" },
  });

  return units.map((unit) => ({
    unitId: unit.id,
    unitCode: unit.unitCode,
    clientName: unit.client?.name ?? "—",
    projectName: unit.project.name,
  }));
}
