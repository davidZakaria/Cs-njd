import type { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";

import type { CsAgentScope } from "@/lib/auth/cs-agent-scope";
import { csAgentUnitScope } from "@/lib/auth/cs-agent-scope";
import { isAdminUnitManager, isCsAgentRole } from "@/lib/auth/unit-roles";
import { unitMatchesOwnerSearchQuery } from "@/lib/units/unit-owner-search";

export type UnitRequestPickerOption = {
  unitId: string;
  unitCode: string;
  projectName: string;
  clientName: string;
  label: string;
};

export function formatUnitRequestPickerLabel(
  unitCode: string,
  projectName: string,
  clientName: string
): string {
  return `${unitCode} · ${projectName} · ${clientName}`;
}

export function unitMatchesRequestPickerSearchQuery(
  trimmed: string
): Prisma.UnitWhereInput {
  const ownerMatch = unitMatchesOwnerSearchQuery(trimmed);
  const ownerClauses = ownerMatch.OR ?? [];

  return {
    OR: [
      ...ownerClauses,
      { project: { name: { contains: trimmed, mode: "insensitive" } } },
    ],
  };
}

/** Units the current user may attach when creating a unit request. */
export function unitWhereVisibleForRequestUnitPicker(
  role: Role,
  csScope: CsAgentScope | null
): Prisma.UnitWhereInput {
  if (isAdminUnitManager(role)) {
    return {};
  }
  if (isCsAgentRole(role) && csScope) {
    return csAgentUnitScope(csScope);
  }
  return { id: { in: [] } };
}

export function resolvePrimaryClientName(input: {
  client: { name: string } | null;
  unitClients: Array<{ role: string; client: { name: string } }>;
}): string {
  const primaryLink = input.unitClients.find((link) => link.role === "PRIMARY");
  if (primaryLink) return primaryLink.client.name;
  if (input.client) return input.client.name;
  return "—";
}

export function mapUnitRowToRequestPickerOption(unit: {
  id: string;
  unitCode: string;
  project: { name: string };
  client: { name: string } | null;
  unitClients: Array<{ role: string; client: { name: string } }>;
}): UnitRequestPickerOption {
  const clientName = resolvePrimaryClientName(unit);
  return {
    unitId: unit.id,
    unitCode: unit.unitCode,
    projectName: unit.project.name,
    clientName,
    label: formatUnitRequestPickerLabel(
      unit.unitCode,
      unit.project.name,
      clientName
    ),
  };
}
