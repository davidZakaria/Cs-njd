import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSignedFind = vi.fn();
const mockRequestFind = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unitGeneratedDocument: {
      findFirst: (...args: unknown[]) => mockSignedFind(...args),
    },
    unitRequest: {
      findFirst: (...args: unknown[]) => mockRequestFind(...args),
    },
  },
}));

describe("official document mutation guards (semantics)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks save/generate when a signed copy exists for the draft", async () => {
    mockSignedFind.mockResolvedValueOnce({ id: "doc-signed", displayName: "Handover" });

    const { assertOfficialTextDraftMutable } = await import(
      "@/lib/official-documents/document-mutation-guards"
    );

    const result = await assertOfficialTextDraftMutable("draft-1");
    expect(result?.success).toBe(false);
    if (result && !result.success) {
      expect(result.error).toMatch(/signed copy on file/i);
    }
  });

  it("blocks mutation when linked request is no longer APPROVED", async () => {
    mockRequestFind.mockResolvedValueOnce({
      status: "CANCELLED",
    });

    const { assertLinkedUnitRequestAllowsOfficialDocumentMutation } = await import(
      "@/lib/official-documents/document-mutation-guards"
    );

    const result = await assertLinkedUnitRequestAllowsOfficialDocumentMutation({
      unitId: "unit-1",
      documentType: "GRACE_PERIOD_ANNEX",
      unitRequestId: "req-1",
    });
    expect(result?.success).toBe(false);
    if (result && !result.success) {
      expect(result.error).toMatch(/no longer approved/i);
    }
  });

  it("allows HANDOVER_RECORD without linked request", async () => {
    const { assertLinkedUnitRequestAllowsOfficialDocumentMutation } = await import(
      "@/lib/official-documents/document-mutation-guards"
    );

    const result = await assertLinkedUnitRequestAllowsOfficialDocumentMutation({
      unitId: "unit-1",
      documentType: "HANDOVER_RECORD",
      unitRequestId: null,
    });
    expect(result).toBeNull();
  });
});
