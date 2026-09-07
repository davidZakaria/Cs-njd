import Tesseract from "tesseract.js";

/** Egyptian national IDs are 14 digits and start with 2 (1900s) or 3 (2000s). */
const EGYPTIAN_NATIONAL_ID_PATTERN = /[23]\d{13}/;

function cleanOcrText(raw: string): string {
  return raw.replace(/\s/g, "").replace(/[Oo]/g, "0");
}

export async function extractEgyptianNationalId(
  imageBuffer: Buffer
): Promise<string | null> {
  try {
    const result = await Tesseract.recognize(imageBuffer, "eng");
    const cleaned = cleanOcrText(result.data.text);
    const match = cleaned.match(EGYPTIAN_NATIONAL_ID_PATTERN);
    return match?.[0] ?? null;
  } catch {
    return null;
  }
}
