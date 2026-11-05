import { describe, expect, it } from "vitest";

import {
  handoverDraftNeedsOfficialMasterSync,
  isLegacyGenericHandoverDraftBody,
  resolveOfficialDocumentTemplateLocale,
  usesOfficialHandoverLegalMasters,
} from "@/lib/official-documents/handover/document-locale";

describe("official handover document locale routing", () => {
  it("forces Arabic template locale for all official document types (CRM policy)", () => {
    expect(
      resolveOfficialDocumentTemplateLocale({
        documentType: "HANDOVER_RECORD",
        projectName: "GREEN AVENUE",
        requestedLocale: "en",
      })
    ).toBe("ar");
    expect(
      resolveOfficialDocumentTemplateLocale({
        documentType: "GRACE_PERIOD_ANNEX",
        projectName: "GREEN AVENUE",
        requestedLocale: "en",
      })
    ).toBe("ar");
  });

  it("forces Arabic for Jura handover records", () => {
    expect(
      resolveOfficialDocumentTemplateLocale({
        documentType: "HANDOVER_RECORD",
        projectName: "JURA",
        requestedLocale: "en",
      })
    ).toBe("ar");
  });

  it("detects legacy generic English handover drafts", () => {
    expect(
      isLegacyGenericHandoverDraftBody(
        "Unit Handover Record\n\nProject: {{projectName}}"
      )
    ).toBe(true);
    expect(isLegacyGenericHandoverDraftBody("محضر تسليم — أولاً")).toBe(false);
  });

  it("flags drafts that need official master sync", () => {
    expect(
      handoverDraftNeedsOfficialMasterSync(
        {
          documentType: "HANDOVER_RECORD",
          templateLocale: "en",
          handoverTemplateKey: null,
          currentBody: "Unit Handover Record\n\nProject: GREEN AVENUE",
        },
        "GREEN AVENUE"
      )
    ).toBe(true);
    expect(
      handoverDraftNeedsOfficialMasterSync(
        {
          documentType: "HANDOVER_RECORD",
          templateLocale: "ar",
          handoverTemplateKey: "green-avenue",
          currentBody: "محضر تسليم",
        },
        "GREEN AVENUE"
      )
    ).toBe(false);
  });

  it("does not apply official masters to other projects", () => {
    expect(
      usesOfficialHandoverLegalMasters({
        documentType: "HANDOVER_RECORD",
        projectName: "OTHER PROJECT",
      })
    ).toBe(false);
  });
});
