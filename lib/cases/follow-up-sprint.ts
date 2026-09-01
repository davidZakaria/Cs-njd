/** True when follow-up is today or already overdue (end-of-day inclusive). */
export function isFollowUpDue(
  isoDate: string | null | undefined,
  now = new Date()
): boolean {
  if (!isoDate) return false;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return date <= endOfToday;
}
