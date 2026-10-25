/** Parse server-provided start-of-day ISO for units overdue filter (stable per calendar day). */
export function parseUnitsFilterTodayStart(
  iso: string | undefined
): Date | null {
  if (!iso) return null;
  return new Date(iso);
}

/** Memo dependency key so client filters do not reset pagination every render. */
export function unitsFilterTodayMemoKey(iso: string | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}
