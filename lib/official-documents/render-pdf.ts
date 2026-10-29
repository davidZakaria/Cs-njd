import { Readable } from "node:stream";

import { PDFDocument, rgb, degrees } from "pdf-lib";

import type { MergeFieldValues } from "@/lib/official-documents/types";
import { interpolateOfficialDocumentTemplate } from "@/lib/official-documents/merge-fields";
import { prepareOfficialPdfFonts } from "@/lib/official-documents/pdf-fonts";
import {
  drawLtrLine,
  drawRtlVisualLine,
  measureVisualLineWidth,
  stripBidiControls,
  validateArabicLogicalLine,
  wrapLogicalParagraph,
} from "@/lib/official-documents/pdf-text-layout";

export async function renderOfficialDocumentPdf(input: {
  title: string;
  bodyTemplate: string;
  fields: MergeFieldValues;
  locale: string;
  watermarkDraft: boolean;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts = await prepareOfficialPdfFonts(pdf);

  const useArabic = input.locale === "ar";
  const body = interpolateOfficialDocumentTemplate(
    input.bodyTemplate,
    input.fields
  );
  const fullText = `${input.title}\n\n${body}`;

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const fontSize = 11;
  const lineHeight = fontSize * 1.45;
  const maxWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  for (const paragraph of fullText.split("\n")) {
    const logicalParagraph = stripBidiControls(paragraph);
    if (useArabic) {
      validateArabicLogicalLine(
        logicalParagraph,
        fonts,
        "official-document-paragraph"
      );
    }

    const lines = wrapLogicalParagraph(
      logicalParagraph,
      maxWidth,
      fonts,
      fontSize,
      useArabic ? "rtl" : "ltr"
    );

    for (const line of lines) {
      if (y < margin + lineHeight) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      if (useArabic) {
        drawRtlVisualLine(page, line, fonts, {
          xRight: pageWidth - margin,
          y,
          fontSize,
        });
      } else {
        drawLtrLine(page, line, fonts, {
          xLeft: margin,
          y,
          fontSize,
        });
      }
      y -= lineHeight;
    }
    y -= lineHeight * 0.35;
  }

  if (input.watermarkDraft) {
    const label = useArabic ? "مسودة — DRAFT" : "DRAFT";
    const wmSize = 42;
    const wmColor = rgb(0.75, 0.75, 0.75);
    if (useArabic) {
      const lineWidth = measureVisualLineWidth(label, fonts, wmSize);
      drawRtlVisualLine(page, label, fonts, {
        xRight: (pageWidth + lineWidth) / 2,
        y: pageHeight / 2,
        fontSize: wmSize,
        color: wmColor,
        opacity: 0.35,
        rotate: degrees(-35),
      });
    } else {
      const wmWidth = fonts.latin.widthOfTextAtSize(label, wmSize);
      page.drawText(label, {
        x: (pageWidth - wmWidth) / 2,
        y: pageHeight / 2,
        size: wmSize,
        font: fonts.latin,
        color: rgb(0.75, 0.75, 0.75),
        rotate: degrees(-35),
        opacity: 0.35,
      });
    }
  }

  return pdf.save();
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function readGeneratedDocumentBytes(
  relativePath: string
): Promise<Uint8Array> {
  const { readStoredObjectStream } = await import("@/lib/storage/object-store");
  const { stream } = await readStoredObjectStream(relativePath);
  return streamToBuffer(stream);
}

/** Generate sample PDF bytes for visual verification (tests / scripts). */
export async function renderArabicSamplePdf(input: {
  title: string;
  body: string;
}): Promise<Uint8Array> {
  return renderOfficialDocumentPdf({
    title: input.title,
    bodyTemplate: input.body,
    fields: {},
    locale: "ar",
    watermarkDraft: true,
  });
}
