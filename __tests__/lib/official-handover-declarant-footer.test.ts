import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { buildOfficialHandoverDraftBody } from "@/lib/official-documents/handover/build-body";
import {
  buildOfficialHandoverHtml,
  renderOfficialHandoverRecordPdf,
} from "@/lib/official-documents/handover/render-pdf";
import { HANDOVER_PRINT_CSS } from "@/lib/official-documents/handover/html/styles";
import type { HandoverFieldValues, HandoverTemplateKey } from "@/lib/print/handover-templates/types";

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

const dualFields: HandoverFieldValues = {
  ...baseFields,
  clientName: "Owner One",
  clientName2: "Owner Two",
  nationalId2: "29001010000002",
};

function fieldsForVariant(key: HandoverTemplateKey): HandoverFieldValues {
  return key.includes("dual") ? dualFields : baseFields;
}

const VARIANTS: HandoverTemplateKey[] = [
  "green-avenue",
  "green-avenue-no-insurance",
  "green-avenue-dual",
  "green-avenue-dual-no-insurance",
  "jura",
  "jura-dual",
];

function pdfPageCount(pdfPath: string): number {
  const out = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const m = out.match(/Pages:\s+(\d+)/);
  return m ? Number(m[1]) : 0;
}

function pdfPageText(pdfPath: string, page: number): string {
  return execFileSync("pdftotext", ["-f", String(page), "-l", String(page), pdfPath, "-"], {
    encoding: "utf8",
  });
}

describe("handover declarant footer (Word footer1 parity)", () => {
  it("embeds a fixed repeated declarant footer and Arabic-only watermark in HTML", () => {
    const html = buildOfficialHandoverHtml({
      templateKey: "green-avenue-no-insurance",
      fields: baseFields,
      watermarkDraft: true,
    });
    expect(HANDOVER_PRINT_CSS).toContain(".handover-declarant-footer");
    expect(html).toContain("handover-declarant-footer");
    expect(html).toContain("المقر بما فيه");
    expect(html).not.toContain("DRAFT");
    expect(html).toContain(">مسودة<");
    expect(html.match(/class="signature-heading"/g)?.length ?? 0).toBe(1);
  });

  it("repeats declarant footer on every PDF page for all six variants (canonical body)", async () => {
    for (const templateKey of VARIANTS) {
      const fields = fieldsForVariant(templateKey);
      const canonical = buildOfficialHandoverDraftBody({ templateKey, fields });

      const pdf = await renderOfficialHandoverRecordPdf({
        templateKey,
        fields,
        watermarkDraft: true,
        draftBody: canonical,
      });

      const dir = mkdtempSync(path.join(tmpdir(), "handover-footer-"));
      const pdfPath = path.join(dir, `${templateKey}.pdf`);
      writeFileSync(pdfPath, pdf);

      const pages = pdfPageCount(pdfPath);
      expect(pages).toBeGreaterThanOrEqual(2);

      for (let page = 1; page <= pages; page += 1) {
        const text = pdfPageText(pdfPath, page);
        expect(text, `${templateKey} page ${page}`).toMatch(/المقر بما فيه/u);
        expect(text).not.toMatch(/\bDRAFT\b/);
      }

      if (templateKey === "green-avenue-no-insurance") {
        const page2 = pdfPageText(pdfPath, 2).replace(/\s+/g, " ").trim();
        expect(page2.startsWith("المقر")).toBe(false);
        expect(page2).toMatch(/المخالفات|بمجرد/u);
      }
    }
  }, 120_000);
});
