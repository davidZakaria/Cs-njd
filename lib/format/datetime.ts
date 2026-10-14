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

  return date.toLocaleString(resolveIntlLocale(locale), formatOptions);
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
