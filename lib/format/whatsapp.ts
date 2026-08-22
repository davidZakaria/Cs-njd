const DEFAULT_COUNTRY_CODE = "20";

/**
 * Normalize a phone string for wa.me links (digits only, Egypt +20 default).
 */
export function sanitizePhoneForWhatsApp(
  raw: string | null | undefined,
  countryCode = DEFAULT_COUNTRY_CODE
): string | null {
  if (!raw?.trim()) return null;

  let digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;

  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  }
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith(countryCode)) {
    return digits.length >= countryCode.length + 8 ? digits : null;
  }

  if (digits.startsWith("0")) {
    digits = `${countryCode}${digits.slice(1)}`;
  } else if (digits.length === 10 && digits.startsWith("1")) {
    digits = `${countryCode}${digits}`;
  } else if (digits.length >= 9 && digits.length <= 11) {
    digits = `${countryCode}${digits}`;
  } else {
    return null;
  }

  return digits.length >= countryCode.length + 8 ? digits : null;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
