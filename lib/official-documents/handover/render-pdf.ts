import fs from "node:fs";
import path from "node:path";

import { degrees, PDFDocument, rgb } from "pdf-lib";

import { prepareOfficialPdfFonts } from "@/lib/official-documents/pdf-fonts";
import {
  drawRtlVisualLine,
  measureVisualLineWidth,
  stripBidiControls,
  validateArabicLogicalLine,
  wrapLogicalParagraph,
} from "@/lib/official-documents/pdf-text-layout";
import { loadHandoverTemplate } from "@/lib/print/handover-templates/resolve";
import type { HandoverTemplateKey } from "@/lib/print/handover-templates/types";

import {
  handoverLogoAssetRelativePath,
  OFFICIAL_HANDOVER_MISSING_PATTERN,
} from "./constants";

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 48;
const fontSize = 10.5;
const lineHeight = fontSize * 1.45;
const maxWidth = pageWidth - margin * 2;

export async function renderOfficialHandoverRecordPdf(input: {
  templateKey: HandoverTemplateKey;
  body: string;
  companyAddress?: string;
  watermarkDraft: boolean;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts = await prepareOfficialPdfFonts(pdf);
  const template = loadHandoverTemplate(input.templateKey);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  y = await drawLogoHeader({
    pdf,
    page,
    y,
    templateKey: input.templateKey,
    dual: template.dual,
  });

  y -= lineHeight;

  for (const paragraph of input.body.split(/\n\n+/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    for (const line of trimmed.split("\n")) {
      const logical = stripBidiControls(line);
      validateArabicLogicalLine(logical, fonts, "handover-body");
      const wrapped = wrapLogicalParagraph(
        logical,
        maxWidth,
        fonts,
        fontSize,
        "rtl"
      );
      for (const wrappedLine of wrapped) {
        if (y < margin + lineHeight * 4) {
          page = pdf.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        y = drawPossiblyHighlightedLine(page, wrappedLine, fonts, y);
      }
      y -= lineHeight * 0.25;
    }
    y -= lineHeight * 0.35;
  }

  y -= lineHeight;
  y = drawSignatureFooter(page, fonts, y, template.dual, input.companyAddress);

  if (input.watermarkDraft) {
    const label = "مسودة — DRAFT";
    const wmSize = 42;
    const wmColor = rgb(0.75, 0.75, 0.75);
    const lineWidth = measureVisualLineWidth(label, fonts, wmSize);
    drawRtlVisualLine(page, label, fonts, {
      xRight: (pageWidth + lineWidth) / 2,
      y: pageHeight / 2,
      fontSize: wmSize,
      color: wmColor,
      opacity: 0.35,
      rotate: degrees(-35),
    });
  }

  return pdf.save();
}

async function drawLogoHeader(input: {
  pdf: PDFDocument;
  page: ReturnType<PDFDocument["addPage"]>;
  y: number;
  templateKey: HandoverTemplateKey;
  dual: boolean;
}): Promise<number> {
  const assetPath = path.join(
    process.cwd(),
    handoverLogoAssetRelativePath(input.templateKey)
  );
  const bytes = fs.readFileSync(assetPath);
  const isJpg = assetPath.endsWith(".jpg");
  const image = isJpg
    ? await input.pdf.embedJpg(bytes)
    : await input.pdf.embedPng(bytes);

  const logoWidth = 140;
  const logoHeight = (image.height / image.width) * logoWidth;
  input.page.drawImage(image, {
    x: (pageWidth - logoWidth) / 2,
    y: input.y - logoHeight,
    width: logoWidth,
    height: logoHeight,
  });

  const y = input.y - logoHeight - lineHeight * 0.5;
  return y;
}

function drawPossiblyHighlightedLine(
  page: ReturnType<PDFDocument["addPage"]>,
  logicalLine: string,
  fonts: Awaited<ReturnType<typeof prepareOfficialPdfFonts>>,
  y: number
): number {
  if (!/⟦[\w]+⟧/.test(logicalLine)) {
    drawRtlVisualLine(page, logicalLine, fonts, {
      xRight: pageWidth - margin,
      y,
      fontSize,
    });
    return y - lineHeight;
  }

  OFFICIAL_HANDOVER_MISSING_PATTERN.lastIndex = 0;
  let xRight = pageWidth - margin;
  const parts = logicalLine.split(/(⟦[\w]+⟧)/g).filter(Boolean);

  for (const part of parts) {
    const isMissing = /^⟦[\w]+⟧$/.test(part);
    const width = measureVisualLineWidth(part, fonts, fontSize);
    if (isMissing) {
      page.drawRectangle({
        x: xRight - width,
        y: y - 2,
        width,
        height: fontSize + 4,
        color: rgb(1, 0.95, 0.6),
        opacity: 0.85,
      });
    }
    drawRtlVisualLine(page, part, fonts, {
      xRight,
      y,
      fontSize,
      color: isMissing ? rgb(0.55, 0.1, 0.1) : undefined,
    });
    xRight -= width;
  }

  return y - lineHeight;
}

function drawSignatureFooter(
  page: ReturnType<PDFDocument["addPage"]>,
  fonts: Awaited<ReturnType<typeof prepareOfficialPdfFonts>>,
  y: number,
  dual: boolean,
  companyAddress?: string
): number {
  const labels = dual
    ? ["توقيع المشتري الأول", "توقيع المشتري الثاني", "توقيع الشركة"]
    : ["توقيع المشتري", "توقيع الشركة"];

  y -= lineHeight;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= lineHeight * 1.5;

  const colWidth = (pageWidth - margin * 2) / labels.length;
  labels.forEach((label, index) => {
    const xRight = pageWidth - margin - colWidth * index;
    drawRtlVisualLine(page, label, fonts, {
      xRight,
      y,
      fontSize: fontSize - 0.5,
    });
    page.drawLine({
      start: { x: xRight - colWidth + 12, y: y - lineHeight * 2.2 },
      end: { x: xRight - 12, y: y - lineHeight * 2.2 },
      thickness: 0.6,
      color: rgb(0.15, 0.15, 0.15),
    });
  });

  if (companyAddress?.trim()) {
    y -= lineHeight * 3.5;
    drawRtlVisualLine(page, companyAddress.trim(), fonts, {
      xRight: pageWidth - margin,
      y,
      fontSize: fontSize - 1.5,
      color: rgb(0.35, 0.35, 0.35),
    });
  }

  return y;
}
