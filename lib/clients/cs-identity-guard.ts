import {
  isPersistedExtraId,
  normalizeContactValue,
} from "@/lib/client/contact-lines";
type ExtraLineInput = { id?: string | null; value: string };

function hasMeaningfulValue(value: string | null | undefined): boolean {
  return value != null && value.trim() !== "";
}

export type ClientIdentitySnapshot = {
  name: string;
  nationalId: string | null;
  email?: string | null;
};

/**
 * CS agents may edit identity fields but cannot clear name, national ID, or email when already set.
 */
export function validateCsClientIdentityUpdate(
  existing: ClientIdentitySnapshot,
  incoming: ClientIdentitySnapshot
): string | null {
  if (
    hasMeaningfulValue(existing.name) &&
    !hasMeaningfulValue(incoming.name)
  ) {
    return "Client name cannot be cleared";
  }
  if (
    hasMeaningfulValue(existing.nationalId) &&
    !hasMeaningfulValue(incoming.nationalId)
  ) {
    return "National ID cannot be cleared";
  }
  if (
    hasMeaningfulValue(existing.email) &&
    !hasMeaningfulValue(incoming.email)
  ) {
    return "Email cannot be cleared";
  }
  return null;
}

export type ClientPrimaryContactSnapshot = {
  phone1: string | null;
  address1: string | null;
};

export function validateCsClientPrimaryContactUpdate(
  existing: ClientPrimaryContactSnapshot,
  incoming: ClientPrimaryContactSnapshot
): string | null {
  if (
    hasMeaningfulValue(existing.phone1) &&
    !hasMeaningfulValue(incoming.phone1)
  ) {
    return "Primary phone cannot be cleared";
  }
  if (
    hasMeaningfulValue(existing.address1) &&
    !hasMeaningfulValue(incoming.address1)
  ) {
    return "Primary address cannot be cleared";
  }
  return null;
}

export function validateCsExtraContactLines(
  existing: Array<{ id: string; value: string }>,
  lines: ExtraLineInput[],
  kind: "phone" | "address"
): string | null {
  const existingById = new Map(existing.map((row) => [row.id, row.value]));
  const label = kind === "phone" ? "phone number" : "address";

  for (const line of lines) {
    const id = line.id?.trim();
    if (!id || !isPersistedExtraId(id)) continue;
    const previous = existingById.get(id);
    if (previous === undefined) continue;
    const next = normalizeContactValue(line.value);
    if (hasMeaningfulValue(previous) && !next) {
      return `Extra ${label} cannot be cleared`;
    }
  }

  return null;
}
