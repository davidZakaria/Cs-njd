import { numberingSystemForLocale } from "@/lib/format/locale-display";

/** Business timezone for NJD CRM (Egypt). DB timestamps remain UTC. */
export const APP_DISPLAY_TIME_ZONE = "Africa/Cairo";

const LOCALE_MAP: Record<string, string> = {
  en: "en-GB",
  ar: "ar-EG",
};

export function resolveIntlLocale(locale: string): string {
  return LOCALE_MAP[locale] ?? locale;
}

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: APP_DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
};

function usesDateOrTimeStyle(options?: Intl.DateTimeFormatOptions): boolean {
  return options?.dateStyle !== undefined || options?.timeStyle !== undefined;
}

export function formatDateTime(
  value: Date | string | number,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const formatOptions: Intl.DateTimeFormatOptions = usesDateOrTimeStyle(options)
    ? { timeZone: APP_DISPLAY_TIME_ZONE, ...options }
    : { ...DEFAULT_OPTIONS, ...options };

  return date.toLocaleString(resolveIntlLocale(locale), {
    numberingSystem: numberingSystemForLocale(locale),
    ...formatOptions,
  });
}

/** Calendar day in Egypt (YYYY-MM-DD) for digest dedupe keys. */
export function cairoCalendarDayKey(value: Date): string {
  return value.toLocaleDateString("en-CA", { timeZone: APP_DISPLAY_TIME_ZONE });
}

/** Consistent app date label (e.g. en: "15 Nov 2026", ar: Egypt locale medium). */
export function formatDisplayDate(
  value: Date | string | number,
  locale: string
): string {
  return formatDateTime(value, locale, { dateStyle: "medium" });
}

export function formatDate(
  value: Date | string | number,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(resolveIntlLocale(locale), {
    timeZone: APP_DISPLAY_TIME_ZONE,
    numberingSystem: numberingSystemForLocale(locale),
    ...options,
  });
}