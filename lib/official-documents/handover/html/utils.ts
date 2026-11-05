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

const LRI = "\u2066";
const PDI = "\u2069";

export function formatLtrField(value: string): string {
  const cleaned = normalizeWesternDigits(value);
  const isolated = `${LRI}${cleaned}${PDI}`;
  return `<bdi class="ltr-field" dir="ltr">${escapeHtml(isolated)}</bdi>`;
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
