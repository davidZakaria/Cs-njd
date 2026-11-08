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
  splitViolationItems,
} from "@/lib/print/handover-templates/fields";
import { loadHandoverTemplate } from "@/lib/print/handover-templates/resolve";
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
    const splitMiddle = split
      .filter((s) => !s.startsWith("بمجرد") && !s.includes("كل ما ورد"))
      .join("");
    const groupMiddle = grouped
      .filter((s) => !s.startsWith("بمجرد") && !s.includes("كل ما ورد"))
      .join("");
    expect(groupMiddle).toBe(splitMiddle);
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
  }, 60_000);
});

afterAll(async () => {
  await closeHandoverPdfBrowser();
});
