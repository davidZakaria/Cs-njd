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

  it("allows legal/management roles to edit draft text (no signed-copy editor lock)", () => {
    expect(canEditOfficialDocumentDraftText("LEGAL")).toBe(true);
    expect(canEditOfficialDocumentDraftText("MANAGEMENT")).toBe(true);
    expect(canGenerateOfficialDocuments("LEGAL")).toBe(true);
    expect(canEditOfficialDocumentDraftText("CS_AGENT")).toBe(false);
  });
});
