export type BilingualPayload = {
  en: string;
  ar: string;
};

const BILINGUAL_PREFIX = "{";

export function encodeBilingual(en: string, ar: string): string {
  return JSON.stringify({ en, ar } satisfies BilingualPayload);
}

export function pickBilingual(
  stored: string,
  locale: string
): string {
  if (!stored.startsWith(BILINGUAL_PREFIX)) {
    return stored;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<BilingualPayload>;
    if (locale === "ar" && parsed.ar) return parsed.ar;
    if (parsed.en) return parsed.en;
    return parsed.ar ?? stored;
  } catch {
    return stored;
  }
}

export function pickBilingualPair(stored: string): BilingualPayload {
  if (!stored.startsWith(BILINGUAL_PREFIX)) {
    return { en: stored, ar: stored };
  }

  try {
    const parsed = JSON.parse(stored) as Partial<BilingualPayload>;
    const en = parsed.en ?? parsed.ar ?? stored;
    const ar = parsed.ar ?? parsed.en ?? stored;
    return { en, ar };
  } catch {
    return { en: stored, ar: stored };
  }
}
