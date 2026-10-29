import fs from "node:fs/promises";
import path from "node:path";

import type { Font } from "@pdf-lib/fontkit";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

import type { HbFontHandle } from "@/lib/official-documents/pdf-harfbuzz";
import { getHbFont } from "@/lib/official-documents/pdf-harfbuzz";

const FONT_DIR = path.join(process.cwd(), "lib/official-documents/assets");

let arabicFontKit: Font | null = null;
let latinFontKit: Font | null = null;
let arabicBytes: Uint8Array | null = null;
let latinBytes: Uint8Array | null = null;

export async function loadPdfFontAssets() {
  if (!arabicBytes) {
    arabicBytes = await fs.readFile(
      path.join(FONT_DIR, "NotoNaskhArabic-Regular.ttf")
    );
  }
  if (!latinBytes) {
    latinBytes = await fs.readFile(
      path.join(FONT_DIR, "NotoSans-Regular.ttf")
    );
  }
  if (!arabicFontKit) {
    arabicFontKit = await fontkit.create(arabicBytes);
  }
  if (!latinFontKit) {
    latinFontKit = await fontkit.create(latinBytes);
  }
  return {
    arabicBytes: arabicBytes!,
    latinBytes: latinBytes!,
    arabicFontKit: arabicFontKit!,
    latinFontKit: latinFontKit!,
  };
}

export async function embedOfficialPdfFonts(pdf: PDFDocument) {
  const { arabicBytes, latinBytes } = await loadPdfFontAssets();
  pdf.registerFontkit(fontkit);
  const arabic = await pdf.embedFont(arabicBytes, {
    subset: false,
    customName: "NotoNaskhArabic",
  });
  const latin = await pdf.embedFont(latinBytes, {
    subset: false,
    customName: "NotoSans",
  });
  return { arabic, latin };
}

export type OfficialPdfFonts = {
  arabic: PDFFont;
  latin: PDFFont;
  arabicFontKit: Font;
  latinFontKit: Font;
  arabicHb: HbFontHandle;
  latinHb: HbFontHandle;
};

export async function prepareOfficialPdfFonts(
  pdf: PDFDocument
): Promise<OfficialPdfFonts> {
  const assets = await loadPdfFontAssets();
  const embedded = await embedOfficialPdfFonts(pdf);
  const arabicHb = await getHbFont(assets.arabicBytes, "arabic");
  const latinHb = await getHbFont(assets.latinBytes, "latin");
  return {
    ...embedded,
    arabicFontKit: assets.arabicFontKit,
    latinFontKit: assets.latinFontKit,
    arabicHb,
    latinHb,
  };
}
