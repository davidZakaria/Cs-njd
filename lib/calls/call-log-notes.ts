/** Server-side marker — survives Arabic notes without a visible emoji prefix. */
export const CALL_LOG_NOTE_MARKER = "\u2063CL\u2063";

const CALL_NOTE_EMOJI_PREFIX = "📞";

/**
 * Normalizes user-entered call notes for persistence.
 * Ensures classification does not depend on the user keeping the prefilled emoji.
 */
export function normalizeCallLogNotesForStorage(notes: string): string {
  const trimmed = notes.trim();
  if (!trimmed) return "";
  if (trimmed.includes(CALL_LOG_NOTE_MARKER)) {
    return trimmed;
  }
  const withoutEmoji = trimmed.startsWith(CALL_NOTE_EMOJI_PREFIX)
    ? trimmed.slice(CALL_NOTE_EMOJI_PREFIX.length).trimStart()
    : trimmed;
  return `${CALL_LOG_NOTE_MARKER}${withoutEmoji}`;
}

export function isPersistedCallLogNote(notes: string): boolean {
  const trimmed = notes.trimStart();
  return (
    trimmed.includes(CALL_LOG_NOTE_MARKER) ||
    trimmed.startsWith(CALL_NOTE_EMOJI_PREFIX)
  );
}

const CALL_LOG_MARKER_TEXT_LEAK = /\u2063|(?:^|(?<=\s))CL(?=\S)/u;

/** True when stored notes still contain a call-log machine marker (incl. visible leaks). */
export function containsCallLogStorageMarker(notes: string): boolean {
  return (
    notes.includes(CALL_LOG_NOTE_MARKER) ||
    CALL_LOG_MARKER_TEXT_LEAK.test(notes)
  );
}

/** Strip machine markers for timeline / inbox snippets (keeps user text). */
export function formatCallLogNotesForDisplay(notes: string): string {
  let text = notes;
  if (text.includes(CALL_LOG_NOTE_MARKER)) {
    text = text.split(CALL_LOG_NOTE_MARKER).join("");
  }
  text = text.replaceAll("\u2063", "").replace(/^CL(?=\S)/u, "");
  const trimmed = text.trimStart();
  if (trimmed.startsWith(CALL_NOTE_EMOJI_PREFIX)) {
    const rest = trimmed.slice(CALL_NOTE_EMOJI_PREFIX.length).trimStart();
    return rest || trimmed;
  }
  return text.trim();
}

export function callLogNotesSnippetForInbox(
  notes: string,
  maxLen = 160
): string {
  const display = formatCallLogNotesForDisplay(notes);
  const trimmed = display.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}