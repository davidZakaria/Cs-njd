function hasMeaningfulValue(value: string | null | undefined): boolean {
  return value != null && value.trim() !== "";
}

export type ClientIdentitySnapshot = {
  name: string;
  nationalId: string | null;
};

/**
 * CS agents may edit identity fields but cannot clear name or national ID when already set.
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
  return null;
}
