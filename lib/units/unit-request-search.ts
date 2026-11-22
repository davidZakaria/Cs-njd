import type { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";

import { canCreateUnitRequest } from "@/lib/requests/permissions-core";
import { unitMatchesOwnerSearchQuery } from "@/lib/units/unit-owner-search";
import {
  isMergedOwnerName,
  splitMergedOwnerNames,
} from "@/lib/utils/arabic-normalize";

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

/** Both owners for lists and headers (CO_OWNER rows or merged "/" primary name). */
export function formatUnitOwnersDisplayName(input: {
  client: { name: string } | null;
  unitClients: Array<{ role: string; client: { name: string } }>;
}): string {
  const coOwners = input.unitClients
    .filter((link) => link.role === "CO_OWNER")
    .map((link) => link.client.name)
    .filter(Boolean);
  const primaryName = resolvePrimaryClientName(input);

  if (coOwners.length > 0) {
    const primaryDisplay = isMergedOwnerName(primaryName)
      ? splitMergedOwnerNames(primaryName)[0] ?? primaryName
      : primaryName;
    return [primaryDisplay, ...coOwners].filter((n) => n && n !== "—").join(" · ");
  }

  if (primaryName !== "—" && isMergedOwnerName(primaryName)) {
    return splitMergedOwnerNames(primaryName).join(" · ");
  }

  return primaryName;
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
