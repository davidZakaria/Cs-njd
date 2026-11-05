import { OFFICIAL_HANDOVER_MISSING_PATTERN } from "@/lib/official-documents/handover/constants";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Arabic-Indic / Persian digits → Western (matches legal masters). */
export function normalizeWesternDigits(text: string): string {
  return text
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}


export function formatLtrField(value: string): string {
  const cleaned = normalizeWesternDigits(value).trim();
  return `<span class="ltr-field" dir="ltr">\u200E${escapeHtml(cleaned)}</span>`;
}

export function toHandoverHtml(text: string): string {
  const withMarkers = text.replace(
    OFFICIAL_HANDOVER_MISSING_PATTERN,
    (match) => `\u0000MISSING:${match}\u0000`
  );
  const western = normalizeWesternDigits(withMarkers);
  const escaped = escapeHtml(western);
  return escaped.replace(
    /\u0000MISSING:(⟦[\w]+⟧)\u0000/g,
    '<span class="missing-field">$1</span>'
  );
}

export function stripGreenSection2Lead(text: string): string {
  return text
    .replace(/^ثانيا\s*:\s*بيانات الوحدة\s*/i, "")
    .replace(/^ثانيا\s*:\s*بيانات\s*الوحدة\s*/i, "")
    .trim();
}

export function stripGreenSection1Lead(text: string): string {
  return text
    .replace(/^[أا]?ول(?:ا|اً)\s*:\s*[-–]?\s*بيانات المستلم\s*/iu, "")
    .trim();
}

/** Drop dual-owner declaration preambles; keep main body from بأننى onward. */
export function stripGreenDualDeclarationPreamble(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const bodyStart = normalized.search(/بأننى|بأنني|بانني/i);
  if (bodyStart >= 0) {
    return normalized.slice(bodyStart).trim();
  }
  return normalized
    .replace(/أقر أنا الموقع أدناه[\s\S]*?(?=بأننى|بأنني|بانني|$)/gi, "")
    .trim();
}

export function countGreenDualOwnerDeclarationIntros(text: string): number {
  return (text.match(/أقر أنا الموقع أدناه/g) ?? []).length;
}
