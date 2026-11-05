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

const LTR_RUN =
  /(\+[\d][\d\s-]{5,}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\d{11,})/g;

export function wrapLtrRuns(html: string): string {
  return html.replace(LTR_RUN, (match) => {
    return `<bdi dir="ltr" class="ltr-isolate">${match}</bdi>`;
  });
}

/** Escape text, highlight blanks, Western digits, and LTR-isolate phones/emails/IDs. */
export function toHandoverHtml(text: string): string {
  const withMarkers = text.replace(
    OFFICIAL_HANDOVER_MISSING_PATTERN,
    (match) => `\u0000MISSING:${match}\u0000`
  );
  const western = normalizeWesternDigits(withMarkers);
  const escaped = escapeHtml(western);
  const highlighted = escaped.replace(
    /\u0000MISSING:(⟦[\w]+⟧)\u0000/g,
    '<span class="missing-field">$1</span>'
  );
  return wrapLtrRuns(highlighted);
}

/** Strip repeated section headings already rendered as HTML headings. */
export function stripGreenSection2Lead(text: string): string {
  return text
    .replace(/^ثانيا\s*:\s*بيانات الوحدة\s*/i, "")
    .replace(/^ثانيا\s*:\s*بيانات\s*الوحدة\s*/i, "")
    .trim();
}

export function stripGreenSection1Lead(text: string): string {
  return text
    .replace(/^اولا\s*:\s*-?\s*بيانات المستلم\s*/i, "")
    .trim();
}
