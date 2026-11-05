import { OFFICIAL_HANDOVER_MISSING_PATTERN } from "@/lib/official-documents/handover/constants";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape text and wrap missing-placeholder tokens for yellow highlight. */
export function toHandoverHtml(text: string): string {
  const withMarkers = text.replace(
    OFFICIAL_HANDOVER_MISSING_PATTERN,
    (match) => `\u0000MISSING:${match}\u0000`
  );
  const escaped = escapeHtml(withMarkers);
  return escaped.replace(
    /\u0000MISSING:(⟦[\w]+⟧)\u0000/g,
    '<span class="missing-field">$1</span>'
  );
}
