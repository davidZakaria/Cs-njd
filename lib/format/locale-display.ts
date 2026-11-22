/**
 * UI number/date digit rules for NJD CRM — see docs/locale-digit-rules.md
 */

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EXT_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

export function resolveNumberFormatLocale(locale: string): string {
  return locale === "ar" ? "ar-EG" : "en-GB";
}

/** Counts, KPIs, pagination, table metrics (not identifiers). */
export function formatLocaleNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(resolveNumberFormatLocale(locale), options).format(
    value
  );
}

export function formatLocaleInteger(value: number, locale: string): string {
  return formatLocaleNumber(value, locale, {
    maximumFractionDigits: 0,
  });
}

export function digitsToWestern(input: string): string {
  let out = "";
  for (const ch of input) {
    const ar = ARABIC_INDIC_DIGITS.indexOf(ch);
    if (ar >= 0) {
      out += String(ar);
      continue;
    }
    const ext = EXT_ARABIC_INDIC.indexOf(ch);
    if (ext >= 0) {
      out += String(ext);
      continue;
    }
    out += ch;
  }
  return out;
}

export function digitsToArabicIndic(input: string): string {
  let out = "";
  for (const ch of input) {
    const digit = ch.charCodeAt(0) - 48;
    if (digit >= 0 && digit <= 9) {
      out += ARABIC_INDIC_DIGITS[digit] ?? ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Search helpers: match Western or Arabic-Indic digit forms in user queries. */
export function searchDigitVariants(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [""];

  const hasWestern = /\d/.test(trimmed);
  const hasArabicIndic = /[٠-٩۰-۹]/.test(trimmed);

  const variants = new Set<string>([trimmed]);
  if (hasWestern) {
    variants.add(digitsToArabicIndic(trimmed));
  }
  if (hasArabicIndic) {
    variants.add(digitsToWestern(trimmed));
  }
  return [...variants];
}

export function localeAgnosticIncludes(
  haystack: string,
  needle: string
): boolean {
  const h = haystack.toLowerCase();
  const variants = searchDigitVariants(needle);
  return variants.some((v) => h.includes(v.toLowerCase()));
}