import { describe, expect, it } from "vitest";

import {
  handoverDraftIsLegacyGenericPlaceholder,
  handoverDraftNeedsOfficialMasterSync,
} from "@/lib/official-documents/handover/document-locale";

describe("official handover metadata sync (no silent body wipe)", () => {
  it("still flags missing template key or non-ar locale for metadata sync", () => {
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
  });

  it("does not flag synced Arabic drafts solely because body differs from template", () => {
    expect(
      handoverDraftNeedsOfficialMasterSync(
        {
          documentType: "HANDOVER_RECORD",
          templateLocale: "ar",
          handoverTemplateKey: "green-avenue",
          currentBody: "محضر تسليم — LEGAL_EDIT_MARKER kept",
        },
        "GREEN AVENUE"
      )
    ).toBe(false);
  });

  it("detects legacy generic placeholder without treating Arabic edits as legacy", () => {
    expect(
      handoverDraftIsLegacyGenericPlaceholder(
        "Unit Handover Record\n\nProject: GREEN AVENUE"
      )
    ).toBe(true);
    expect(
      handoverDraftIsLegacyGenericPlaceholder(
        "محضر — USER_EDIT_KEEP marker"
      )
    ).toBe(false);
  });
});
