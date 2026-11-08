import { describe, expect, it } from "vitest";

import {
  isHandoverDraftAppendixChunk,
  mergeTrailingHandoverAppendixChunks,
} from "@/lib/official-documents/handover/draft-body-structure";

describe("handover draft appendix chunk merge", () => {
  it("detects LEGAL_E2E and short ASCII append-only chunks", () => {
    expect(isHandoverDraftAppendixChunk("LEGAL_E2E_NONCE_en_green-avenue")).toBe(true);
    expect(isHandoverDraftAppendixChunk("User legal note in English only")).toBe(true);
    expect(isHandoverDraftAppendixChunk("ملحق عربي")).toBe(false);
    expect(isHandoverDraftAppendixChunk("x".repeat(200))).toBe(false);
  });

  it("merges trailing appendix chunks onto the preceding body chunk", () => {
    const merged = mergeTrailingHandoverAppendixChunks([
      "بيانات",
      "نص عربي طويل",
      "LEGAL_E2E_NONCE_en_green-avenue",
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[1]).toContain("LEGAL_E2E_NONCE_en_green-avenue");
    expect(merged[1]).toContain("نص عربي");
    expect(merged[1]).not.toMatch(/\n\nLEGAL_E2E/);
  });
});
