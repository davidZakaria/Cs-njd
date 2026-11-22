import { formatDateTime, resolveIntlLocale } from "@/lib/format/datetime";

/** Relative label for activity feeds; full Cairo datetime via {@link formatDateTime}. */
export function formatRelativeActivityTime(
  value: Date | string | number,
  locale: string,
  nowMs: number = Date.now()
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = nowMs - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  const rtf = new Intl.RelativeTimeFormat(resolveIntlLocale(locale), {
    numeric: "always",
  });

  if (diffMinutes < 1) {
    return rtf.format(0, "minute");
  }
  if (diffMinutes < 60) {
    return rtf.format(-diffMinutes, "minute");
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return rtf.format(-diffHours, "hour");
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return rtf.format(-diffDays, "day");
  }

  return formatDateTime(date, locale, { dateStyle: "medium" });
}