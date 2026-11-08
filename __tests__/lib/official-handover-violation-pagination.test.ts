import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { buildOfficialHandoverDraftBody } from "@/lib/official-documents/handover/build-body";
import {
  closeHandoverPdfBrowser,
  renderOfficialHandoverRecordPdf,
} from "@/lib/official-documents/handover/render-pdf";
import {
  groupViolationItemsForPrint,
  interpolateHandoverText,
  joinViolationPieces,
  splitViolationItems,
} from "@/lib/print/handover-templates/fields";
import { loadHandoverTemplate } from "@/lib/print/handover-templates/resolve";
import type { HandoverFieldValues, HandoverTemplateKey } from "@/lib/print/handover-templates/types";

const ALL_VARIANTS: HandoverTemplateKey[] = [
  "green-avenue",
  "green-avenue-no-insurance",
  "green-avenue-dual",
  "green-avenue-dual-no-insurance",
  "jura",
  "jura-dual",
];

function fieldsFor(key: HandoverTemplateKey): HandoverFieldValues {
  if (!key.includes("dual")) return baseFields;
  return {
    ...baseFields,
    clientName: "Owner One",
    clientName2: "Owner Two",
    nationalId2: "29001010000002",
  };
}

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

function pdfPageCount(pdf: Buffer): number {
  const m = execFileSync("pdfinfo", ["-"], { encoding: "utf8", input: pdf }).match(/Pages:\s+(\d+)/);
  return m ? Number(m[1]) : 0;
}

function pdfPageText(pdf: Buffer, page: number): string {
  return execFileSync("pdftotext", ["-f", String(page), "-l", String(page), "-", "-"], {
    encoding: "utf8",
    input: pdf,
  });
}

function substantiveChars(pageText: string): number {
  return pageText
    .replace(/المقر بما فيه/gu, "")
    .replace(/مسودة/gu, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

describe("handover violation pagination", () => {
  it("preserves exact violation wording when regrouping for print", () => {
    const template = loadHandoverTemplate("green-avenue");
    expect(template.kind).toBe("green-avenue");
    const body = interpolateHandoverText(
      template.kind === "green-avenue" ? template.violationsBody : "",
      baseFields
    );
    const split = splitViolationItems(body);
    const grouped = groupViolationItemsForPrint(split);
    const regrouped = joinViolationPieces(grouped);
    expect(regrouped).toBe(joinViolationPieces(split));
    expect(regrouped).not.toMatch(/عدمعمل/u);
    expect(grouped.length).toBeLessThan(split.length);
  });

  it("insured Green Avenue fits 3 pages without a near-blank insurance tail page", async () => {
    const canonical = buildOfficialHandoverDraftBody({
      templateKey: "green-avenue",
      fields: baseFields,
    });
    const pdf = await renderOfficialHandoverRecordPdf({
      templateKey: "green-avenue",
      fields: baseFields,
      watermarkDraft: true,
      draftBody: canonical,
    });

    const pages = pdfPageCount(Buffer.from(pdf));
    expect(pages).toBe(3);

    for (let p = 1; p <= pages; p += 1) {
      const text = pdfPageText(Buffer.from(pdf), p);
      expect(text).toMatch(/المقر بما فيه/u);
      expect(substantiveChars(text)).toBeGreaterThan(600);
    }

    const page2 = pdfPageText(Buffer.from(pdf), 2).replace(/\s+/g, " ").trim();
    expect(page2.startsWith("عدم")).toBe(false);
    expect(page2).toMatch(/بمجرد|المخالفات/u);
    const full = execFileSync("pdftotext", ["-", "-"], { encoding: "utf8", input: Buffer.from(pdf) });
    expect(full).not.toMatch(/عدمعمل/u);
  }, 60_000);

  it("all six variants avoid near-blank tail pages on canonical body", async () => {
    const minSubstantiveLastPage = 1400;
    for (const templateKey of ALL_VARIANTS) {
      const fields = fieldsFor(templateKey);
      const canonical = buildOfficialHandoverDraftBody({ templateKey, fields });
      const pdf = await renderOfficialHandoverRecordPdf({
        templateKey,
        fields,
        watermarkDraft: true,
        draftBody: canonical,
      });
      const pages = pdfPageCount(Buffer.from(pdf));
      for (let p = 1; p <= pages; p += 1) {
        const substantive = substantiveChars(pdfPageText(Buffer.from(pdf), p));
        expect(substantive, `${templateKey} page ${p}`).toBeGreaterThanOrEqual(
          p === pages ? minSubstantiveLastPage : 600
        );
      }
      const full = execFileSync("pdftotext", ["-", "-"], { encoding: "utf8", input: Buffer.from(pdf) });
      expect(full).not.toMatch(/عدمعمل/u);
    }
  }, 180_000);
});

afterAll(async () => {
  await closeHandoverPdfBrowser();
});
