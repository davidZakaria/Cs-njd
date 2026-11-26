import { describe, expect, it } from "vitest";

import {
  CALL_LOG_NOTE_MARKER,
  callLogNotesSnippetForInbox,
  formatCallLogNotesForDisplay,
  isPersistedCallLogNote,
  normalizeCallLogNotesForStorage,
} from "@/lib/calls/call-log-notes";

describe("call log notes", () => {
  it("tags Arabic-only notes on the server", () => {
    const stored = normalizeCallLogNotesForStorage("عند الاتصال مع العميلة");
    expect(isPersistedCallLogNote(stored)).toBe(true);
    expect(formatCallLogNotesForDisplay(stored)).toBe("عند الاتصال مع العميلة");
  });

  it("preserves legacy emoji-prefixed notes", () => {
    const stored = normalizeCallLogNotesForStorage("📞 Follow-up tomorrow");
    expect(isPersistedCallLogNote(stored)).toBe(true);
    expect(formatCallLogNotesForDisplay(stored)).toBe("Follow-up tomorrow");
  });

  it("does not double-tag normalized notes", () => {
    const once = normalizeCallLogNotesForStorage("ملاحظة");
    const twice = normalizeCallLogNotesForStorage(once);
    expect(twice).toBe(once);
  });

  it("inbox snippets never expose the storage marker or CL prefix", () => {
    const stored = normalizeCallLogNotesForStorage(
      "عند الاتصال مع العميلة — تأكيد الموعد"
    );
    const snippet = callLogNotesSnippetForInbox(stored);
    expect(snippet).toBe("عند الاتصال مع العميلة — تأكيد الموعد");
    expect(snippet).not.toContain("CL");
    expect(snippet).not.toContain(CALL_LOG_NOTE_MARKER);
    expect(snippet).not.toMatch(/\u2063/);
  });
});