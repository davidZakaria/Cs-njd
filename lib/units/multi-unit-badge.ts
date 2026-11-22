import { prisma, activeUnitWhere } from "@/lib/prisma";
import {
  normalizeArabic,
  splitMergedOwnerNames,
  normalizePhone,
} from "@/lib/utils/arabic-normalize";
import type { Prisma } from "@prisma/client";

export type MultiUnitBadgeData = {
  unitCount: number;
  otherUnits: Array<{ id: string; unitCode: string; projectName: string }>;
};

/**
 * Check if any owner of this unit owns another unit.
 * Uses multi-step matching:
 * 1. Exact client ID match (fastest)
 * 2. National ID match (indexed)
 * 3. Phone number match (indexed)
 * 4. Normalized Arabic name match (application-level fuzzy match)
 * 
 * Handles merged "/" names by splitting into individual owners.
 * Returns badge data if owner(s) own 2+ units total, null otherwise.
 */
export async function getMultiUnitBadgeData(
  clientIds: string[],
  currentUnitId: string
): Promise<MultiUnitBadgeData | null> {
  if (clientIds.length === 0) return null;

  const currentClients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: {
      id: true,
      name: true,
      phone1: true,
      phone2: true,
      nationalId: true,
      phones: { select: { phone: true } },
    },
  });

  if (currentClients.length === 0) return null;

  const clientIdSet = new Set(clientIds);
  const nationalIds: string[] = [];
  const phones: string[] = [];
  const normalizedNames: string[] = [];

  for (const client of currentClients) {
    if (client.nationalId) {
      nationalIds.push(client.nationalId);
    }
    
    if (client.phone1) phones.push(client.phone1);
    if (client.phone2) phones.push(client.phone2);
    client.phones?.forEach((p) => phones.push(p.phone));
    
    const names = splitMergedOwnerNames(client.name);
    if (names.length === 0) names.push(client.name);
    for (const name of names) {
      const norm = normalizeArabic(name);
      if (norm) normalizedNames.push(norm);
    }
  }

  const normalizedPhones = phones.map(normalizePhone).filter(Boolean);

  const baseWhere = activeUnitWhere({ id: { not: currentUnitId } });
  const orConditions: Prisma.UnitWhereInput[] = [];

  if (clientIds.length > 0) {
    orConditions.push({ clientId: { in: clientIds } });
    orConditions.push({ unitClients: { some: { clientId: { in: clientIds } } } });
  }

  if (nationalIds.length > 0) {
    orConditions.push({ client: { nationalId: { in: nationalIds } } });
    orConditions.push({ unitClients: { some: { client: { nationalId: { in: nationalIds } } } } });
  }

  if (phones.length > 0) {
    orConditions.push({ client: { phone1: { in: phones } } });
    orConditions.push({ client: { phone2: { in: phones } } });
    orConditions.push({ client: { phones: { some: { phone: { in: phones } } } } });
    orConditions.push({ unitClients: { some: { client: { phone1: { in: phones } } } } });
    orConditions.push({ unitClients: { some: { client: { phone2: { in: phones } } } } });
    orConditions.push({ unitClients: { some: { client: { phones: { some: { phone: { in: phones } } } } } } });
  }

  if (orConditions.length === 0) return null;

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

  const matchingUnits: Array<{ id: string; unitCode: string; projectName: string }> = [];
  const normalizedNamesSet = new Set(normalizedNames);

  for (const unit of candidateUnits) {
    const allClients = [
      unit.client,
      ...unit.unitClients.map((uc) => uc.client),
    ].filter(Boolean);

    let matches = false;

    for (const client of allClients) {
      if (!client) continue;

      if (clientIdSet.has(client.id)) {
        matches = true;
        break;
      }

      if (client.nationalId && nationalIds.includes(client.nationalId)) {
        matches = true;
        break;
      }

      const clientPhones = [
        client.phone1,
        client.phone2,
        ...(client.phones?.map((p) => p.phone) ?? []),
      ].filter(Boolean);
      
      for (const phone of clientPhones) {
        const norm = normalizePhone(phone);
        if (norm && normalizedPhones.includes(norm)) {
          matches = true;
          break;
        }
      }
      if (matches) break;

      const clientNames = splitMergedOwnerNames(client.name);
      if (clientNames.length === 0) clientNames.push(client.name);
      
      for (const name of clientNames) {
        const norm = normalizeArabic(name);
        if (norm && normalizedNamesSet.has(norm)) {
          matches = true;
          break;
        }
      }
      if (matches) break;
    }

    if (matches) {
      matchingUnits.push({
        id: unit.id,
        unitCode: unit.unitCode,
        projectName: unit.project.name,
      });
    }

    if (matchingUnits.length >= 10) break;
  }

  if (matchingUnits.length === 0) return null;

  return {
    unitCount: matchingUnits.length + 1,
    otherUnits: matchingUnits,
  };
}
