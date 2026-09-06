import type { FinishingPhase } from "@prisma/client";

import { prisma, activeTicketWhere, activeUnitWhere } from "@/lib/prisma";

export type EngineeringQueueUnit = {
  id: string;
  unitCode: string;
  projectName: string;
  customModifications: string | null;
  packageType: string | null;
  phases: FinishingPhase[];
  engineeringTicketId: string | null;
};

function engineerUnitScope(engineerUserId: string) {
  return {
    OR: [{ assignedEngineerId: null }, { assignedEngineerId: engineerUserId }],
  };
}
export async function getEngineeringQueueUnits(
  engineerUserId: string
): Promise<EngineeringQueueUnit[]> {
  const engineeringTicketFilter = activeTicketWhere({
    pendingParty: "ENGINEERING",
    status: { not: "RESOLVED" },
  });

  const units = await prisma.unit.findMany({
    where: activeUnitWhere({
      ...engineerUnitScope(engineerUserId),
      tickets: { some: engineeringTicketFilter },
    }),
    select: {
      id: true,
      unitCode: true,
      project: { select: { name: true } },
      finishing: {
        select: {
          customModifications: true,
          packageType: true,
          phases: true,
          phase: true,
        },
      },
      tickets: {
        where: engineeringTicketFilter,
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { unitCode: "asc" },
  });

  return units.map((unit) => ({
    id: unit.id,
    unitCode: unit.unitCode,
    projectName: unit.project.name,
    customModifications: unit.finishing?.customModifications ?? null,
    packageType: unit.finishing?.packageType ?? null,
    phases:
      unit.finishing?.phases?.length
        ? unit.finishing.phases
        : unit.finishing?.phase
          ? [unit.finishing.phase]
          : [],
    engineeringTicketId: unit.tickets[0]?.id ?? null,
  }));
}

export function isUnitInEngineeringQueue(
  unit: {
    assignedEngineerId: string | null;
    tickets: Array<{ pendingParty: string | null; status: string; deletedAt: Date | null }>;
  },
  engineerUserId: string
): boolean {
  if (
    unit.assignedEngineerId &&
    unit.assignedEngineerId !== engineerUserId
  ) {
    return false;
  }

  return unit.tickets.some(
    (ticket) =>
      !ticket.deletedAt &&
      ticket.status !== "RESOLVED" &&
      ticket.pendingParty === "ENGINEERING"
  );
}
