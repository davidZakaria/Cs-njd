import {
  isPersistedExtraId,
  normalizeContactValue,
} from "@/lib/client/contact-lines";
import { prisma } from "@/lib/prisma";

export type ContactSyncClient = Pick<typeof prisma, "clientPhone" | "clientAddress">;

export type ExtraLineInput = {
  id?: string | null;
  value: string;
};

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeContactValue(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export async function syncClientExtraPhones(
  tx: ContactSyncClient,
  clientId: string,
  primaryPhone: string | null,
  lines: ExtraLineInput[]
): Promise<void> {
  const primary = normalizeContactValue(primaryPhone);
  const desiredLines = lines
    .map((line) => ({
      id: line.id && isPersistedExtraId(line.id) ? line.id : null,
      value: normalizeContactValue(line.value),
    }))
    .filter((line) => line.value && line.value !== primary);

  const deduped: Array<{ id: string | null; value: string }> = [];
  const seen = new Set<string>();
  for (const line of desiredLines) {
    if (seen.has(line.value)) continue;
    seen.add(line.value);
    deduped.push(line);
  }

  const existing = await tx.clientPhone.findMany({
    where: { clientId },
    orderBy: { sortOrder: "asc" },
  });

  const keepIds = new Set(
    deduped.filter((line) => line.id).map((line) => line.id as string)
  );

  for (const row of existing) {
    if (!keepIds.has(row.id)) {
      await tx.clientPhone.delete({ where: { id: row.id } });
    }
  }

  let sortOrder = 0;
  for (const line of deduped) {
    if (line.id) {
      await tx.clientPhone.update({
        where: { id: line.id },
        data: { phone: line.value, sortOrder },
      });
    } else {
      await tx.clientPhone.create({
        data: { clientId, phone: line.value, sortOrder },
      });
    }
    sortOrder += 1;
  }
}

export async function syncClientExtraAddresses(
  tx: ContactSyncClient,
  clientId: string,
  primaryAddress: string | null,
  lines: ExtraLineInput[]
): Promise<void> {
  const primary = normalizeContactValue(primaryAddress);
  const desiredLines = lines
    .map((line) => ({
      id: line.id && isPersistedExtraId(line.id) ? line.id : null,
      value: normalizeContactValue(line.value),
    }))
    .filter((line) => line.value && line.value !== primary);

  const deduped: Array<{ id: string | null; value: string }> = [];
  const seen = new Set<string>();
  for (const line of desiredLines) {
    if (seen.has(line.value)) continue;
    seen.add(line.value);
    deduped.push(line);
  }

  const existing = await tx.clientAddress.findMany({
    where: { clientId },
    orderBy: { sortOrder: "asc" },
  });

  const keepIds = new Set(
    deduped.filter((line) => line.id).map((line) => line.id as string)
  );

  for (const row of existing) {
    if (!keepIds.has(row.id)) {
      await tx.clientAddress.delete({ where: { id: row.id } });
    }
  }

  let sortOrder = 0;
  for (const line of deduped) {
    if (line.id) {
      await tx.clientAddress.update({
        where: { id: line.id },
        data: { address: line.value, sortOrder },
      });
    } else {
      await tx.clientAddress.create({
        data: { clientId, address: line.value, sortOrder },
      });
    }
    sortOrder += 1;
  }
}

export function phonesForCreate(
  primaryPhone: string | null,
  legacyPhone2: string | null,
  extras: ExtraLineInput[]
): string[] {
  const primary = normalizeContactValue(primaryPhone);
  const fromExtras = extras.map((line) => normalizeContactValue(line.value));
  const legacy = normalizeContactValue(legacyPhone2);
  return uniqueNonEmpty([...fromExtras, legacy]).filter((phone) => phone !== primary);
}

export function addressesForCreate(
  primaryAddress: string | null,
  legacyAddress2: string | null,
  extras: ExtraLineInput[]
): string[] {
  const primary = normalizeContactValue(primaryAddress);
  const fromExtras = extras.map((line) => normalizeContactValue(line.value));
  const legacy = normalizeContactValue(legacyAddress2);
  return uniqueNonEmpty([...fromExtras, legacy]).filter(
    (address) => address !== primary
  );
}
