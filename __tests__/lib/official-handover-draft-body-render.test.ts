import { describe, expect, it } from "vitest";

import { buildOfficialHandoverDraftBody } from "@/lib/official-documents/handover/build-body";
import { buildOfficialHandoverHtml } from "@/lib/official-documents/handover/render-pdf";
import type { HandoverFieldValues } from "@/lib/print/handover-templates/types";

const baseFields: HandoverFieldValues = {
  clientName: "Demo Owner",
  nationality: "مصري",
  nationalId: "26309100200715",
  address: "Sample Street",
  phone1: "+201000000001",
  phone2: "—",
  email: "owner@example.test",
  unitNumber: "701",
  floor: "3",
  building: "B",
  area: "145",
  areaInWords: "145",
  handoverDate: "17/05/2026",
  contractDay: "30",
  contractMonth: "September",
  contractYear: "2025",
  issuedDayName: "Sunday",
  issuedDate: "17/05/2026",
  contractShortDate: "30/09/2025",
};

describe("official handover PDF uses edited draft body", () => {
  it("embeds a legal edit marker from the saved draft body in generated HTML", () => {
    const canonical = buildOfficialHandoverDraftBody({
      templateKey: "green-avenue",
      fields: baseFields,
    });
    const edited = `${canonical}\n\nLEGAL_EDIT_MARKER: clause adjusted by legal.`;

    const html = buildOfficialHandoverHtml({
      templateKey: "green-avenue",
      fields: baseFields,
      watermarkDraft: true,
      draftBody: edited,
    });

    expect(html).toContain("LEGAL_EDIT_MARKER");
    expect(html).toContain("clause adjusted by legal");
    expect(html).toContain("violations-block");
    expect(html).toContain("المخالفات");
  });

  it("keeps full Green Avenue clauses when draft matches canonical serialized body", () => {
    const canonical = buildOfficialHandoverDraftBody({
      templateKey: "green-avenue",
      fields: baseFields,
    });

    const html = buildOfficialHandoverHtml({
      templateKey: "green-avenue",
      fields: baseFields,
      watermarkDraft: true,
      draftBody: canonical,
    });

    expect(html).toContain("violations-block");
    expect(html).toMatch(/insurance-block|تأمين/u);
    expect(html).toContain("Demo Owner");
    expect(html).toContain("26309100200715");
  });
});
