import { describe, expect, it } from "vitest";

import { callLogNotesSnippetForInbox, normalizeCallLogNotesForStorage } from "@/lib/calls/call-log-notes";
import { formatCallLogNotesForDisplay } from "@/lib/calls/call-log-notes";
import { encodeBilingual } from "@/lib/notifications/bilingual";

function mockDispatchMessage(notes: string, actorName: string, unitLabel: string): string {
  const snippet = callLogNotesSnippetForInbox(notes);
  const messageEn = `${actorName} · Unit ${unitLabel} · Client${snippet ? ` · ${snippet}` : ""}`;
  return encodeBilingual(messageEn, messageEn);
}

describe("call log inbox / notification preview copy", () => {
  it("notification message bodies omit storage markers", () => {
    const stored = normalizeCallLogNotesForStorage(
      "عند الاتصال مع العميلة — تأكيد الموعد"
    );
    const encoded = mockDispatchMessage(stored, "Nardine", "5C05");
    expect(encoded).not.toContain("CLعند");
    expect(encoded).not.toMatch(/\u2063/);
    expect(encoded).toContain("عند الاتصال مع العميلة");
  });

  it("display formatter matches inbox snippet", () => {
    const stored = normalizeCallLogNotesForStorage("ملاحظة عربية");
    expect(callLogNotesSnippetForInbox(stored)).toBe(
      formatCallLogNotesForDisplay(stored)
    );
  });
});