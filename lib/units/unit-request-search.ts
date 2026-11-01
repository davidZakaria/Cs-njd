import type { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";

import { canCreateUnitRequest } from "@/lib/requests/permissions-core";
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

/** Active units eligible for the request picker (role may create requests). */
export function unitWhereVisibleForRequestUnitPicker(
  role: Role
): Prisma.UnitWhereInput {
  return canCreateUnitRequest(role) ? {} : { id: { in: [] } };
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
