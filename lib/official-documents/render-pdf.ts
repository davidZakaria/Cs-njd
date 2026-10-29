import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, degrees } from "pdf-lib";

import type { MergeFieldValues } from "@/lib/official-documents/types";
import { interpolateOfficialDocumentTemplate } from "@/lib/official-documents/merge-fields";

const FONT_DIR = path.join(process.cwd(), "lib/official-documents/assets");

let arabicFontBytes: Uint8Array | null = null;
let latinFontBytes: Uint8Array | null = null;

async function loadFonts() {
  if (!arabicFontBytes) {
    arabicFontBytes = await fs.readFile(
      path.join(FONT_DIR, "NotoNaskhArabic-Regular.ttf")
    );
  }
  if (!latinFontBytes) {
    latinFontBytes = await fs.readFile(
      path.join(FONT_DIR, "NotoSans-Regular.ttf")
    );
  }
  return { arabicFontBytes, latinFontBytes };
}

export async function renderOfficialDocumentPdf(input: {
  title: string;
  bodyTemplate: string;
  fields: MergeFieldValues;
  locale: string;
  watermarkDraft: boolean;
}): Promise<Uint8Array> {
  const { arabicFontBytes: arBytes, latinFontBytes: enBytes } = await loadFonts();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const useArabic = input.locale === "ar";
  const font = await pdf.embedFont(useArabic ? arBytes! : enBytes!);
  const bodyFont = await pdf.embedFont(useArabic ? arBytes! : enBytes!);

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
    const lines = wrapText(paragraph, font, fontSize, maxWidth);
    for (const line of lines.length > 0 ? lines : [""]) {
      if (y < margin + lineHeight) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      const x = useArabic
        ? pageWidth - margin - textWidth
        : margin;
      page.drawText(line, {
        x,
        y,
        size: fontSize,
        font: bodyFont,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= lineHeight;
    }
    y -= lineHeight * 0.35;
  }

  if (input.watermarkDraft) {
    const label = useArabic ? "مسودة — DRAFT" : "DRAFT";
    const wmSize = 42;
    const wmFont = font;
    const wmWidth = wmFont.widthOfTextAtSize(label, wmSize);
    page.drawText(label, {
      x: (pageWidth - wmWidth) / 2,
      y: pageHeight / 2,
      size: wmSize,
      font: wmFont,
      color: rgb(0.75, 0.75, 0.75),
      rotate: degrees(-35),
      opacity: 0.35,
    });
  }

  return pdf.save();
}

function wrapText(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontSize: number,
  maxWidth: number
): string[] {
  if (!text.trim()) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
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
