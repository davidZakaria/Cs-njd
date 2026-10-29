import { describe, expect, it } from "vitest";

import { DEFAULT_OFFICIAL_DOCUMENT_TEMPLATES } from "@/lib/official-documents/default-templates";
import {
  buildOfficialDocumentMergeFields,
  interpolateOfficialDocumentTemplate,
} from "@/lib/official-documents/merge-fields";
import { loadPdfFontAssets } from "@/lib/official-documents/pdf-fonts";
import {
  assertRunHasNoNotdefGlyphs,
  formatShortDateForOfficialPdf,
  layoutRunWithFontkit,
  measureVisualLineWidth,
  orderRunsForRtlLine,
  parseTextRuns,
  pickFontKitFont,
  stripBidiControls,
  validateArabicLogicalLine,
} from "@/lib/official-documents/pdf-text-layout";
import { prepareOfficialPdfFonts } from "@/lib/official-documents/pdf-fonts";
import { renderOfficialDocumentPdf } from "@/lib/official-documents/render-pdf";
import { PDFDocument } from "pdf-lib";

const sampleUnit = {
  unitCode: "101-3-B",
  area: 120,
  gracePeriod: "٦ أشهر",
  contractPricePerMeter: 45000,
  swapOutgoingUnitCode: null,
  swapOutgoingProjectName: null,
  swappedFromUnitCode: null,
  swappedFromProjectName: null,
  project: { name: "GREEN AVENUE" },
  client: {
    name: "أحمد علي",
    nationalId: "123",
    email: "a@example.com",
    phone1: null,
    phone2: null,
    address1: "القاهرة",
    address2: null,
    phones: [],
    addresses: [],
  },
  unitClients: [
    {
      role: "PRIMARY",
      client: {
        name: "أحمد علي",
        nationalId: "123",
        email: "a@example.com",
        phone1: "+20100000000",
        phone2: null,
        address1: "القاهرة",
        address2: null,
        phones: [{ id: "p1", phone: "+20100000000", sortOrder: 0 }],
        addresses: [{ id: "a1", address: "القاهرة", sortOrder: 0 }],
      },
    },
  ],
  contractWorkflow: {
    contractDate: new Date("2024-01-15"),
    deliveryDate: new Date("2026-06-01"),
  },
  finishing: null,
};

describe("official-document Arabic PDF layout", () => {
  it("formats Arabic PDF dates with Arabic-Indic digits and no bidi controls", () => {
    const formatted = formatShortDateForOfficialPdf(
      new Date("2026-10-29T12:00:00Z"),
      "ar"
    );
    expect(formatted).toBe("٢٩/١٠/٢٠٢٦");
    expect(stripBidiControls(formatted)).toBe(formatted);
  });

  it("orders mixed Arabic/Latin runs for RTL lines without .notdef glyphs", async () => {
    await loadPdfFontAssets();
    const pdf = await PDFDocument.create();
    const fonts = await prepareOfficialPdfFonts(pdf);
    const line = "المشروع: GREEN AVENUE";
    validateArabicLogicalLine(line, fonts, "test-line");
    const runs = orderRunsForRtlLine(parseTextRuns(line));
    expect(runs[0]?.script).toBe("latin");
    expect(runs[runs.length - 1]?.script).toBe("arabic");
    for (const run of runs) {
      const fk = pickFontKitFont(run, fonts);
      const { glyphs } = layoutRunWithFontkit(run, fk);
      expect(glyphs.every((g) => g.id !== 0)).toBe(true);
    }
    expect(measureVisualLineWidth(line, fonts, 11)).toBeGreaterThan(0);
  });

  it("renders Arabic grace period and handover PDFs without missing glyphs", async () => {
    const fields = buildOfficialDocumentMergeFields(sampleUnit, "ar", {
      requestDescription: "تمديد فترة السماح",
      issuedAt: new Date("2026-10-29T12:00:00Z"),
    });

    const graceTemplate = DEFAULT_OFFICIAL_DOCUMENT_TEMPLATES.find(
      (t) => t.documentType === "GRACE_PERIOD_ANNEX" && t.locale === "ar"
    )!;
    const handoverTemplate = DEFAULT_OFFICIAL_DOCUMENT_TEMPLATES.find(
      (t) => t.documentType === "HANDOVER_RECORD" && t.locale === "ar"
    )!;

    const graceBody = interpolateOfficialDocumentTemplate(
      graceTemplate.body,
      fields
    );
    for (const paragraph of graceBody.split("\n")) {
      if (!paragraph.trim()) continue;
      await loadPdfFontAssets();
      const pdf = await PDFDocument.create();
      const fonts = await prepareOfficialPdfFonts(pdf);
      validateArabicLogicalLine(paragraph, fonts, "grace-body");
    }

    const gracePdf = await renderOfficialDocumentPdf({
      title: graceTemplate.title,
      bodyTemplate: graceTemplate.body,
      fields,
      locale: "ar",
      watermarkDraft: true,
    });
    const handoverPdf = await renderOfficialDocumentPdf({
      title: handoverTemplate.title,
      bodyTemplate: handoverTemplate.body,
      fields,
      locale: "ar",
      watermarkDraft: true,
    });

    expect(gracePdf.byteLength).toBeGreaterThan(5000);
    expect(handoverPdf.byteLength).toBeGreaterThan(5000);
  });
});

describe("assertRunHasNoNotdefGlyphs", () => {
  it("throws when Latin is shaped with the Arabic font", async () => {
    const { arabicFontKit } = await loadPdfFontAssets();
    expect(() =>
      assertRunHasNoNotdefGlyphs(
        { text: "GREEN", script: "latin" },
        arabicFontKit,
        "negative-test"
      )
    ).toThrow(/Missing glyphs/);
  });
});
