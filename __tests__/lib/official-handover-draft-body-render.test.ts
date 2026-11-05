import { describe, expect, it } from "vitest";

import { buildOfficialHandoverDraftBody } from "@/lib/official-documents/handover/build-body";
import { countGreenDualOwnerDeclarationIntros } from "@/lib/official-documents/handover/html/utils";
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
    expect(html).toContain("+201000000001");
    expect(html).toContain("owner@example.test");
    expect(html).toContain("Sample Street");
  });

  it("does not duplicate dual Green Avenue owner names in serialized draft", () => {
    const fields: HandoverFieldValues = {
      ...baseFields,
      clientName: "Owner One",
      clientName2: "Owner Two",
      nationalId2: "26309100200716",
    };
    const canonical = buildOfficialHandoverDraftBody({
      templateKey: "green-avenue-dual",
      fields,
    });
    expect(canonical).not.toMatch(/Owner One Owner One/);
    expect(canonical).not.toMatch(/Owner Two Owner One/);
    expect(canonical).toContain("Owner Two");

    const html = buildOfficialHandoverHtml({
      templateKey: "green-avenue-dual",
      fields,
      watermarkDraft: true,
      draftBody: canonical,
    });
    expect(html.match(/<div class="owner-block">/g)?.length ?? 0).toBe(2);
    expect(html).not.toMatch(/Owner One Owner One/);
    expect(countGreenDualOwnerDeclarationIntros(html)).toBe(2);
  });

  it("preserves dual declaration main body when preamble was stripped to بأننى", () => {
    const fields: HandoverFieldValues = {
      ...baseFields,
      clientName: "Owner One",
      clientName2: "Owner Two",
      nationalId2: "26309100200716",
    };
    const canonical = buildOfficialHandoverDraftBody({
      templateKey: "green-avenue-dual-no-insurance",
      fields,
    });
    const decl = canonical.split(/\n\n+/).find((c) => c.startsWith("إقرار")) ?? "";
    const bodyOnly = decl.replace(/^إقرار\s*/u, "").trim();
    const edited = bodyOnly.replace(/مسئ[^\s]+ كاملة/u, (m) => `${m} E2E_REPLACED`);
    const draftBody = canonical.replace(bodyOnly, edited);
    const html = buildOfficialHandoverHtml({
      templateKey: "green-avenue-dual-no-insurance",
      fields,
      watermarkDraft: true,
      draftBody,
    });
    expect(html).toContain("E2E_REPLACED");
    expect(countGreenDualOwnerDeclarationIntros(html)).toBe(2);
  });

  it("renders Green violations section heading exactly once", () => {
    const fields: HandoverFieldValues = {
      ...baseFields,
    };
    const draftBody = buildOfficialHandoverDraftBody({
      templateKey: "green-avenue",
      fields,
    });
    const html = buildOfficialHandoverHtml({
      templateKey: "green-avenue",
      fields,
      watermarkDraft: true,
      draftBody,
    });
    const heading = "المخالفات المتسببة فى فسخ العقد";
    const matches = html.match(
      new RegExp(`<h2 class="section-heading">${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</h2>`, "g")
    );
    expect(matches?.length ?? 0).toBe(1);
  });

  it("includes master voiding tail and insurance block in canonical Green HTML", () => {
    const draftBody = buildOfficialHandoverDraftBody({
      templateKey: "green-avenue",
      fields: baseFields,
    });
    const html = buildOfficialHandoverHtml({
      templateKey: "green-avenue",
      fields: baseFields,
      watermarkDraft: true,
      draftBody,
    });
    expect(html).toMatch(/مفسوخ|حكم قضائي/u);
    expect(html).toContain('class="justified insurance-block"');
    const blockMatch = html.match(/<div class="violations-block">([\s\S]*?)<\/div>/);
    expect(blockMatch?.[1] ?? "").not.toMatch(/و في حالة رغبة الطرف الثاني/u);
  });
});
