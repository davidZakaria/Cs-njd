/**
 * Arabic text normalization utilities for client matching.
 * 
 * Handles common Arabic text variations:
 * - Alef variants: ا/أ/إ/آ → ا
 * - Ta marbuta vs Ha: ة → ه
 * - Alef maqsura vs Ya: ى → ي
 * - Strip diacritics (tashkeel)
 * - Normalize whitespace
 */

const ALEF_VARIANTS = /[\u0622\u0623\u0625]/g; // آ أ إ → ا
const TA_MARBUTA = /\u0629/g; // ة → ه
const ALEF_MAQSURA = /\u0649/g; // ى → ي
const DIACRITICS = /[\u064B-\u065F\u0670]/g; // Arabic diacritics (tashkeel)
const WHITESPACE = /\s+/g;

/**
 * Normalize Arabic text for fuzzy matching.
 * Returns lowercase, stripped of diacritics, with unified character variants.
 */
export function normalizeArabic(text: string): string {
  if (!text) return "";
  
  return text
    .replace(ALEF_VARIANTS, "\u0627") // آ أ إ → ا
    .replace(TA_MARBUTA, "\u0647") // ة → ه
    .replace(ALEF_MAQSURA, "\u064A") // ى → ي
    .replace(DIACRITICS, "") // Remove tashkeel
    .replace(WHITESPACE, "") // Remove all whitespace for comparison
    .toLowerCase()
    .trim();
}

/**
 * Split a merged owner name string into individual names.
 * Handles "/" separator commonly used in production data.
 * 
 * Example: "Joseph Shenouda / Mariam Maher" → ["Joseph Shenouda", "Mariam Maher"]
 */
export function splitMergedOwnerNames(name: string): string[] {
  if (!name) return [];
  
  return name
    .split(/\s*\/\s*/)
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * Check if a merged name string contains multiple owners.
 */
export function isMergedOwnerName(name: string): boolean {
  return name?.includes("/") ?? false;
}

/**
 * Extract the primary owner name from a merged string.
 */
export function extractPrimaryOwnerName(name: string): string {
  const parts = splitMergedOwnerNames(name);
  return parts[0] ?? name;
}

/**
 * Extract the co-owner name from a merged string (second part after "/").
 */
export function extractCoOwnerName(name: string): string | null {
  const parts = splitMergedOwnerNames(name);
  return parts[1] ?? null;
}

/**
 * Check if two names match after normalization.
 * Handles both Arabic and English names.
 */
export function namesMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  
  const norm1 = normalizeArabic(name1);
  const norm2 = normalizeArabic(name2);
  
  return norm1 === norm2;
}

/**
 * Check if any name from list1 matches any name from list2.
 */
export function anyNameMatches(names1: string[], names2: string[]): boolean {
  for (const n1 of names1) {
    for (const n2 of names2) {
      if (namesMatch(n1, n2)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Normalize a phone number for comparison.
 * Strips common prefixes and non-digit characters.
 */
/** Strip Excel / import float suffix (e.g. `96599034830.0` → `96599034830`). */
export function stripExcelNumericSuffix(value: string): string {
  return value.replace(/\.0+$/u, "").trim();
}

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";

  const normalizedInput = stripExcelNumericSuffix(phone);
  let digits = normalizedInput.replace(/\D/g, ""); // Remove non-digits
  
  // Remove Egypt country code prefixes in order of specificity
  if (digits.startsWith("002")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("20") && digits.length > 10) {
    digits = digits.slice(2);
  }
  
  // Remove leading zero if present (Egyptian mobile format)
  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }
  
  return digits;
}

/**
 * Check if two phone numbers match after normalization.
 */
export function phonesMatch(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  const norm1 = normalizePhone(phone1);
  const norm2 = normalizePhone(phone2);
  
  if (!norm1 || !norm2) return false;
  
  return norm1 === norm2 || norm1.endsWith(norm2) || norm2.endsWith(norm1);
}

/**
 * Normalize a national ID for comparison.
 */
export function normalizeNationalId(id: string | null | undefined): string {
  if (!id) return "";
  return id.replace(/\D/g, "").trim();
}

/**
 * Check if two national IDs match.
 */
export function nationalIdsMatch(id1: string | null | undefined, id2: string | null | undefined): boolean {
  const norm1 = normalizeNationalId(id1);
  const norm2 = normalizeNationalId(id2);
  
  if (!norm1 || !norm2) return false;
  
  return norm1 === norm2;
}
