const CURRENCY_SUFFIX: Record<string, string> = {
  ar: "ج.م",
  en: "EGP",
};

export function formatCurrency(
  value: number | null | undefined,
  locale: string
): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    maximumFractionDigits: 2,
  }).format(value);
  const suffix = currencySuffix(locale);
  return locale === "ar" ? `${formatted} ${suffix}` : `${suffix} ${formatted}`;
}

export function currencySuffix(locale: string): string {
  return CURRENCY_SUFFIX[locale] ?? CURRENCY_SUFFIX.en;
}
