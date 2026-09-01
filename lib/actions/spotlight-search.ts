"use server";

import { auth } from "@/lib/auth";
import { resolveCsAgentScope } from "@/lib/auth/cs-agent-scope";
import { prisma } from "@/lib/prisma";
import { activeUnitWhere } from "@/lib/prisma";

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

  const csScope =
    session.user.role === "CS_AGENT"
      ? await resolveCsAgentScope(session.user)
      : null;

  const agentScope = csScope
    ? { agentId: csScope.effectiveAgentId }
    : undefined;

  const units = await prisma.unit.findMany({
    where: activeUnitWhere({
      ...(agentScope ?? {}),
      OR: [
        { unitCode: { contains: trimmed, mode: "insensitive" } },
        {
          client: {
            OR: [
              { name: { contains: trimmed, mode: "insensitive" } },
              { phone1: { contains: trimmed } },
              { phone2: { contains: trimmed } },
            ],
          },
        },
      ],
    }),
    include: {
      project: { select: { name: true } },
      client: { select: { name: true } },
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
