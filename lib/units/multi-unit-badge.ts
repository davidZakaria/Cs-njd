import { prisma, activeUnitWhere } from "@/lib/prisma";
import {
  normalizeArabic,
  splitMergedOwnerNames,
  normalizePhone,
  normalizeNationalId,
  namesMatch,
} from "@/lib/utils/arabic-normalize";
import type { Prisma } from "@prisma/client";

export type MultiUnitBadgeUnit = {
  id: string;
  unitCode: string;
  projectName: string;
  isCurrent: boolean;
};

export type MultiUnitBadgeData = {
  unitCount: number;
  /** All units owned by this client (including the current unit), sorted for display. */
  units: MultiUnitBadgeUnit[];
};

export type ClientIdentityFields = {
  id: string;
  name: string;
  phone1?: string | null;
  phone2?: string | null;
  nationalId?: string | null;
  phones?: Array<{ phone: string }>;
};

const PHONE_PLACEHOLDER_RE =
  /^(\?{2,}|؟{2,}|-|–|—|n\/a|na|null|none|\.{2,}|0{1,3}|x+|\*+)$/i;

const NID_PLACEHOLDER_RE =
  /^(\?{2,}|؟{2,}|-|–|—|n\/a|na|null|none|\.{2,}|x+|\*+)$/i;

const MIN_PHONE_DIGITS = 10;
const EGYPTIAN_NID_LENGTH = 14;

export function isNationalIdPlaceholder(raw: string | null | undefined): boolean {
  if (raw == null) return true;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  return NID_PLACEHOLDER_RE.test(trimmed);
}

export function isPhonePlaceholder(raw: string | null | undefined): boolean {
  if (raw == null) return true;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (PHONE_PLACEHOLDER_RE.test(trimmed)) return true;
  const digits = normalizePhone(trimmed);
  return digits.length < MIN_PHONE_DIGITS;
}

export function isValidNationalIdForMatch(
  raw: string | null | undefined
): string | null {
  if (isNationalIdPlaceholder(raw)) return null;
  const normalized = normalizeNationalId(raw);
  if (normalized.length !== EGYPTIAN_NID_LENGTH) return null;
  return normalized;
}

export function normalizeQualityPhone(
  raw: string | null | undefined
): string | null {
  if (isPhonePlaceholder(raw)) return null;
  const normalized = normalizePhone(raw);
  if (normalized.length < MIN_PHONE_DIGITS) return null;
  return normalized;
}

/** Full name: at least two name parts (avoids accidental slash fragments or single tokens). */
export function isFullOwnerName(name: string): boolean {
  const parts = splitMergedOwnerNames(name);
  const candidates = parts.length > 0 ? parts : [name];
  return candidates.some((candidate) => {
    const tokens = candidate
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    return tokens.length >= 2;
  });
}

export function collectQualityPhones(client: ClientIdentityFields): string[] {
  const raw = [
    client.phone1,
    client.phone2,
    ...(client.phones?.map((p) => p.phone) ?? []),
  ];
  const out = new Set<string>();
  for (const value of raw) {
    const norm = normalizeQualityPhone(value);
    if (norm) out.add(norm);
  }
  return [...out];
}

export function collectComparableNames(client: ClientIdentityFields): string[] {
  const names = splitMergedOwnerNames(client.name);
  if (names.length === 0 && client.name) names.push(client.name);
  return names
    .map((n) => normalizeArabic(n))
    .filter((n) => n.length > 0);
}

function anyFullNameMatches(
  clientA: ClientIdentityFields,
  clientB: ClientIdentityFields
): boolean {
  const namesA = splitMergedOwnerNames(clientA.name);
  const namesB = splitMergedOwnerNames(clientB.name);
  if (namesA.length === 0 && clientA.name) namesA.push(clientA.name);
  if (namesB.length === 0 && clientB.name) namesB.push(clientB.name);

  for (const nameA of namesA) {
    if (!isFullOwnerName(nameA)) continue;
    for (const nameB of namesB) {
      if (!isFullOwnerName(nameB)) continue;
      if (namesMatch(nameA, nameB)) return true;
    }
  }
  return false;
}

function anyQualityPhoneMatches(
  phonesA: string[],
  phonesB: string[]
): boolean {
  for (const a of phonesA) {
    for (const b of phonesB) {
      if (a === b || a.endsWith(b) || b.endsWith(a)) return true;
    }
  }
  return false;
}

/**
 * Decide whether two client records represent the same owner for multi-unit matching.
 */
export function clientsRepresentSameOwner(
  reference: ClientIdentityFields,
  candidate: ClientIdentityFields
): boolean {
  if (reference.id === candidate.id) return true;

  const refNid = isValidNationalIdForMatch(reference.nationalId);
  const candNid = isValidNationalIdForMatch(candidate.nationalId);

  if (refNid && candNid) {
    return refNid === candNid;
  }

  const refPhones = collectQualityPhones(reference);
  const candPhones = collectQualityPhones(candidate);
  const phonesMatch =
    refPhones.length > 0 &&
    candPhones.length > 0 &&
    anyQualityPhoneMatches(refPhones, candPhones);

  if (!phonesMatch) return false;

  return anyFullNameMatches(reference, candidate);
}

function unitHasMatchingOwner(
  reference: ClientIdentityFields,
  unitClients: ClientIdentityFields[]
): boolean {
  return unitClients.some((c) => clientsRepresentSameOwner(reference, c));
}

/**
 * Units owned by a single client (excluding junk identity fields).
 */
export async function getMultiUnitBadgeData(
  clientId: string,
  currentUnitId: string,
  currentUnit: { unitCode: string; projectName: string }
): Promise<MultiUnitBadgeData | null> {
  const referenceClient = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      phone1: true,
      phone2: true,
      nationalId: true,
      phones: { select: { phone: true } },
    },
  });

  if (!referenceClient) return null;

  const refNid = isValidNationalIdForMatch(referenceClient.nationalId);

  const baseWhere = activeUnitWhere({ id: { not: currentUnitId } });
  const orConditions: Prisma.UnitWhereInput[] = [
    { clientId },
    { unitClients: { some: { clientId } } },
  ];

  if (refNid) {
    orConditions.push({ client: { nationalId: referenceClient.nationalId! } });
    orConditions.push({
      unitClients: { some: { client: { nationalId: referenceClient.nationalId! } } },
    });
  }

  const rawPhones = [
    referenceClient.phone1,
    referenceClient.phone2,
    ...(referenceClient.phones?.map((p) => p.phone) ?? []),
  ].filter((p): p is string => Boolean(p) && !isPhonePlaceholder(p));

  if (rawPhones.length > 0) {
    orConditions.push({ client: { phone1: { in: rawPhones } } });
    orConditions.push({ client: { phone2: { in: rawPhones } } });
    orConditions.push({ client: { phones: { some: { phone: { in: rawPhones } } } } });
    orConditions.push({
      unitClients: { some: { client: { phone1: { in: rawPhones } } } },
    });
    orConditions.push({
      unitClients: { some: { client: { phone2: { in: rawPhones } } } },
    });
    orConditions.push({
      unitClients: {
        some: { client: { phones: { some: { phone: { in: rawPhones } } } } },
      },
    });
  }

  const candidateUnits = await prisma.unit.findMany({
    where: {
      ...baseWhere,
      OR: orConditions,
    },
    select: {
      id: true,
      unitCode: true,
      project: { select: { name: true } },
      client: {
        select: {
          id: true,
          name: true,
          phone1: true,
          phone2: true,
          nationalId: true,
          phones: { select: { phone: true } },
        },
      },
      unitClients: {
        select: {
          client: {
            select: {
              id: true,
              name: true,
              phone1: true,
              phone2: true,
              nationalId: true,
              phones: { select: { phone: true } },
            },
          },
        },
      },
    },
    orderBy: [{ project: { name: "asc" } }, { unitCode: "asc" }],
    take: 50,
  });

  const otherUnits: MultiUnitBadgeUnit[] = [];

  for (const unit of candidateUnits) {
    const clientsOnUnit: ClientIdentityFields[] = [];
    if (unit.client) clientsOnUnit.push(unit.client);
    for (const uc of unit.unitClients) {
      if (uc.client) clientsOnUnit.push(uc.client);
    }

    if (unitHasMatchingOwner(referenceClient, clientsOnUnit)) {
      otherUnits.push({
        id: unit.id,
        unitCode: unit.unitCode,
        projectName: unit.project.name,
        isCurrent: false,
      });
    }

    if (otherUnits.length >= 20) break;
  }

  if (otherUnits.length === 0) return null;

  const currentEntry: MultiUnitBadgeUnit = {
    id: currentUnitId,
    unitCode: currentUnit.unitCode,
    projectName: currentUnit.projectName,
    isCurrent: true,
  };

  const units = [...otherUnits, currentEntry].sort((a, b) => {
    const projectCmp = a.projectName.localeCompare(b.projectName);
    if (projectCmp !== 0) return projectCmp;
    return a.unitCode.localeCompare(b.unitCode);
  });

  return {
    unitCount: units.length,
    units,
  };
}