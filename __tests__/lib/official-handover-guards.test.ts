import { describe, expect, it } from "vitest";

import { canEditOfficialDocumentDraftNow } from "@/lib/official-documents/approved-request-option";
import {
  canEditOfficialDocumentDraftText,
  canGenerateOfficialDocuments,
} from "@/lib/official-documents/permissions";

describe("official handover authorization guards", () => {
  it("blocks edit/generate UI when an approved request is required but missing", () => {
    expect(
      canEditOfficialDocumentDraftNow({ needsRequest: true, unitRequestId: "" })
    ).toBe(false);
  });

  it("restricts draft edit/generate to legal and management roles", () => {
    expect(canEditOfficialDocumentDraftText("LEGAL")).toBe(true);
    expect(canEditOfficialDocumentDraftText("MANAGEMENT")).toBe(true);
    expect(canGenerateOfficialDocuments("LEGAL")).toBe(true);
    expect(canEditOfficialDocumentDraftText("CS_AGENT")).toBe(false);
  });
});