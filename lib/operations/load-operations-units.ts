import { prisma } from "@/lib/prisma";
import { activeUnitWhere } from "@/lib/prisma";
import { projectNameToSlug } from "@/lib/cases/cases-filter-url";
import { computeOperationsProgress } from "@/lib/operations/operations-progress";
import { mapUnitToOperationsProgressInput } from "@/lib/operations/map-unit-to-progress-input";
import type { Prisma } from "@prisma/client";

export const operationsUnitInclude = {
  project: { select: { name: true } },
  client: { select: { name: true, nationalIdFile: true } },
  agent: { select: { id: true, name: true } },
  unitClients: {
    orderBy: [{ role: "asc" }, { position: "asc" }],
    select: {
      role: true,
      position: true,
      client: { select: { nationalIdFile: true } },
    },
  },
  contractWorkflow: true,
  finishing: true,
} satisfies Prisma.UnitInclude;

export type OperationsUnitRecord = Prisma.UnitGetPayload<{
  include: typeof operationsUnitInclude;
}>;

export async function loadOperationsProgressUnits() {
  const units = await prisma.unit.findMany({
    where: activeUnitWhere({}),
    include: operationsUnitInclude,
    orderBy: [{ project: { name: "asc" } }, { unitCode: "asc" }],
  });

  return units.map(mapUnitRecordToRow);
}

export function mapUnitRecordToRow(unit: OperationsUnitRecord) {
  const progress = computeOperationsProgress(
    mapUnitToOperationsProgressInput({
      gracePeriod: unit.gracePeriod,
      area: unit.area,
      clientId: unit.clientId,
      client: unit.client,
      unitClients: unit.unitClients,
      contractWorkflow: unit.contractWorkflow,
      finishing: unit.finishing,
    })
  );

  return {
    id: unit.id,
    unitCode: unit.unitCode,
    project: unit.project.name,
    projectSlug: projectNameToSlug(unit.project.name),
    clientName: unit.client?.name ?? "—",
    agentId: unit.agentId,
    agentName: unit.agent?.name ?? null,
    handoverStatus: unit.contractWorkflow?.handoverStatus ?? "PENDING",
    progress,
    searchText: [unit.unitCode, unit.project.name, unit.client?.name]
      .filter(Boolean)
      .join(" "),
  };
}

export type OperationsProgressUnitRow = ReturnType<typeof mapUnitRecordToRow>;
