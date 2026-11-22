import {
  digitsToArabicIndic,
  formatLocaleInteger,
} from "@/lib/format/locale-display";
import { resolveIntlLocale } from "@/lib/format/datetime";

const EN_MONTH_TO_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/**
 * Localize grace-period chip text (seed/DB often stores English Excel strings).
 */
export function formatGracePeriodLabel(
  gracePeriod: string | null,
  locale: string,
  activeUntilLabel: (month: string, year: string) => string
): string | null {
  if (!gracePeriod?.trim()) return null;

  const activeUntil = gracePeriod.match(
    /active\s+until\s+([A-Za-z]+)\s+(\d{4})/i
  );
  if (activeUntil && locale === "ar") {
    const monthKey = activeUntil[1].toLowerCase().slice(0, 3);
    const year = Number.parseInt(activeUntil[2], 10);
    const monthIndex = EN_MONTH_TO_INDEX[monthKey];
    if (monthIndex != null && !Number.isNaN(year)) {
      const month = new Date(year, monthIndex, 1).toLocaleDateString(
        resolveIntlLocale(locale),
        { month: "long", numberingSystem: "arab" }
      );
      return activeUntilLabel(month, formatLocaleInteger(year, locale));
    }
  }

  if (locale === "ar") {
    return digitsToArabicIndic(gracePeriod);
  }

  return gracePeriod;
}