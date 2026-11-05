import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildOfficialHandoverDraftBody } from "@/lib/official-documents/handover/build-body";
import { validateOfficialHandoverDraftStructure } from "@/lib/official-documents/handover/draft-body-structure";
import { buildOfficialHandoverHtml, renderOfficialHandoverRecordPdf } from "@/lib/official-documents/handover/render-pdf";
import type { HandoverFieldValues } from "@/lib/print/handover-templates/types";

const baseFields: HandoverFieldValues = {
  clientName: "Demo Owner",
  nationality: "مصري",
  nationalId: "29001010000001",
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

function pdfText(pdfBytes: Uint8Array): string {
  const tmp = path.join(os.tmpdir(), `handover-fidelity-${Date.now()}.pdf`);
  fs.writeFileSync(tmp, pdfBytes);
  try {
    return execFileSync("pdftotext", [tmp, "-"], { encoding: "utf8" });
  } finally {
    fs.unlinkSync(tmp);
  }
}

describe("official handover draft → PDF text fidelity", () => {
  it("reflects in-clause replacement, sentence deletion, and appended note exactly", async () => {
    const canonical = buildOfficialHandoverDraftBody({
      templateKey: "green-avenue",
      fields: baseFields,
    });

    const phraseMatch = canonical.match(/مسئ[^\s]+ كاملة/u);
    expect(phraseMatch).not.toBeNull();
    const phraseOriginal = phraseMatch![0]!;
    const phraseReplacement = `${phraseOriginal} E2E_REPLACED`;

    const deleteMatch = canonical.match(
      /وفى حالة مخالفة اياً مما ذكر[\s\S]{0,220}?حكم قضائي\./u
    );
    expect(deleteMatch).not.toBeNull();
    const sentenceToDelete = deleteMatch![0]!;
    const deletedFragment = sentenceToDelete.slice(0, 40);

    let edited = canonical.replace(phraseOriginal, phraseReplacement);
    edited = edited.replace(sentenceToDelete, "");
    const appended = "LEGAL_APPEND_E2E: management note appended.";
    edited = `${edited.trimEnd()}\n\n${appended}`;

    const structure = validateOfficialHandoverDraftStructure({
      templateKey: "green-avenue",
      draftBody: edited,
    });
    expect(structure.ok).toBe(true);

    const pdf = await renderOfficialHandoverRecordPdf({
      templateKey: "green-avenue",
      fields: baseFields,
      watermarkDraft: true,
      draftBody: edited,
    });
    const html = buildOfficialHandoverHtml({
      templateKey: "green-avenue",
      fields: baseFields,
      watermarkDraft: true,
      draftBody: edited,
    });
    expect(html).toContain(appended);
    expect(html).toContain("E2E_REPLACED");

    const text = pdfText(pdf);
    expect(text).toContain("E2E_REPLACED");
    expect(text).not.toContain(deletedFragment);
    expect(text).toMatch(/مخالف|الإلتزامات/u);
  });

  it("rejects generate when insurance section was removed from deposit variant", () => {
    const canonical = buildOfficialHandoverDraftBody({
      templateKey: "green-avenue",
      fields: baseFields,
    });
    const chunks = canonical.split(/\n\n+/);
    const withoutInsurance = chunks.filter((c) => !/تأمين/u.test(c)).join("\n\n");
    const structure = validateOfficialHandoverDraftStructure({
      templateKey: "green-avenue",
      draftBody: withoutInsurance,
    });
    expect(structure.ok).toBe(false);
  });
});
