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

export function formatDateTime(
  value: Date | string | number,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(resolveIntlLocale(locale), {
    ...DEFAULT_OPTIONS,
    ...options,
  });
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
    ...options,
  });
}
