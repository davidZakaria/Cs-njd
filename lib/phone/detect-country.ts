import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

export type PhoneCountryDetection = {
  /** ISO 3166-1 alpha-2 region code, or null when unknown. */
  countryCode: CountryCode | null;
  isUnknown: boolean;
};

const DEFAULT_NATIONAL_REGION: CountryCode = "EG";

function normalizeInput(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

function parseInternational(trimmed: string) {
  const candidate = trimmed.startsWith("00")
    ? `+${trimmed.slice(2).replace(/\s/g, "")}`
    : trimmed;
  return parsePhoneNumberFromString(candidate);
}

function parseWithPlusDigits(trimmed: string) {
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return undefined;
  return parsePhoneNumberFromString(`+${digits}`);
}

function parseAsNational(trimmed: string, region: CountryCode) {
  return parsePhoneNumberFromString(trimmed, region);
}

function displayRegionForNumber(
  parsed: NonNullable<ReturnType<typeof parsePhoneNumberFromString>>
): CountryCode {
  const region = parsed.country;
  if (!region) return DEFAULT_NATIONAL_REGION;
  if (
    parsed.countryCallingCode === "44" &&
    (region === "GG" || region === "IM" || region === "JE")
  ) {
    return "GB";
  }
  return region;
}

function toDetection(parsed: ReturnType<typeof parsePhoneNumberFromString>): PhoneCountryDetection {
  if (parsed?.isValid() && parsed.country) {
    return { countryCode: displayRegionForNumber(parsed), isUnknown: false };
  }
  return { countryCode: null, isUnknown: true };
}

/**
 * Infer country for display only. Does not normalize or validate stored values.
 */
export function detectPhoneCountry(raw: string | null | undefined): PhoneCountryDetection {
  const trimmed = normalizeInput(raw);
  if (!trimmed) {
    return { countryCode: null, isUnknown: true };
  }

  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    const international = toDetection(parseInternational(trimmed));
    if (!international.isUnknown) return international;
  }

  if (trimmed.startsWith("0")) {
    const egyptNational = toDetection(parseAsNational(trimmed, DEFAULT_NATIONAL_REGION));
    if (!egyptNational.isUnknown) return egyptNational;
  }

  const plusDigits = toDetection(parseWithPlusDigits(trimmed));
  if (!plusDigits.isUnknown) return plusDigits;

  const fallbackNational = toDetection(
    parseAsNational(trimmed, DEFAULT_NATIONAL_REGION)
  );
  if (!fallbackNational.isUnknown) return fallbackNational;

  return { countryCode: null, isUnknown: true };
}

export function countryFlagEmoji(regionCode: string): string {
  const code = regionCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65)
  );
}

export function localizedCountryName(regionCode: string, locale: string): string {
  try {
    const display = new Intl.DisplayNames([locale], { type: "region" });
    return display.of(regionCode) ?? regionCode;
  } catch {
    return regionCode;
  }
}
