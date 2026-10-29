import type { Font } from "@pdf-lib/fontkit";
import type { PDFFont, PDFPage, Rotation } from "pdf-lib";
import { rgb } from "pdf-lib";

import type { OfficialPdfFonts } from "@/lib/official-documents/pdf-fonts";
import {
  assertHarfbuzzTextHasGlyphs,
  drawHarfbuzzTextLine,
  measureHarfbuzzTextWidth,
} from "@/lib/official-documents/pdf-harfbuzz";

const BIDI_CONTROL =
  /[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF]/g;

export type RunScript = "arabic" | "latin" | "neutral";

export type TextRun = {
  text: string;
  script: RunScript;
};

export function stripBidiControls(text: string): string {
  return text.replace(BIDI_CONTROL, "");
}

/** Arabic-Indic digits without locale bidi marks (avoids .notdef in PDF fonts). */
export function toArabicIndicDigits(text: string): string {
  return text.replace(/\d/g, (d) =>
    String.fromCharCode(0x0660 + Number(d))
  );
}

export function formatShortDateForOfficialPdf(date: Date, locale: string): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  const formatted = `${day}/${month}/${year}`;
  return locale === "ar" ? toArabicIndicDigits(formatted) : formatted;
}

function isArabicLetter(code: number): boolean {
  return (
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0x0750 && code <= 0x077f) ||
    (code >= 0x08a0 && code <= 0x08ff) ||
    (code >= 0xfb50 && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff)
  );
}

function isArabicDigit(code: number): boolean {
  return code >= 0x0660 && code <= 0x0669;
}

function classifyCodePoint(code: number): RunScript {
  if (isArabicLetter(code) || isArabicDigit(code)) return "arabic";
  if (
    (code >= 0x0041 && code <= 0x005a) ||
    (code >= 0x0061 && code <= 0x007a) ||
    (code >= 0x0030 && code <= 0x0039) ||
    code === 0x00b2 ||
    code === 0x00b3 ||
    code === 0x0028 ||
    code === 0x0029 ||
    code === 0x003a ||
    code === 0x002f ||
    code === 0x002d ||
    code === 0x002e
  ) {
    return "latin";
  }
  return "neutral";
}

export function parseTextRuns(text: string): TextRun[] {
  const cleaned = stripBidiControls(text);
  const runs: TextRun[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const code = cleaned.codePointAt(i)!;
    const charLen = code > 0xffff ? 2 : 1;
    let script = classifyCodePoint(code);
    if (script === "neutral") {
      script = "latin";
    }
    let j = i + charLen;
    while (j < cleaned.length) {
      const next = cleaned.codePointAt(j)!;
      const nextLen = next > 0xffff ? 2 : 1;
      let nextScript = classifyCodePoint(next);
      if (nextScript === "neutral") nextScript = "latin";
      if (nextScript !== script) break;
      j += nextLen;
    }
    runs.push({ text: cleaned.slice(i, j), script });
    i = j;
  }
  return runs;
}

export function orderRunsForRtlLine(runs: TextRun[]): TextRun[] {
  return [...runs].reverse();
}

export function pickPdfFont(
  run: TextRun,
  fonts: Pick<OfficialPdfFonts, "arabic" | "latin">
): PDFFont {
  return run.script === "arabic" ? fonts.arabic : fonts.latin;
}

export function pickFontKitFont(
  run: TextRun,
  fonts: Pick<OfficialPdfFonts, "arabicFontKit" | "latinFontKit">
): Font {
  return run.script === "arabic" ? fonts.arabicFontKit : fonts.latinFontKit;
}

export function layoutRunWithFontkit(
  run: TextRun,
  fontKit: Font
): { glyphs: { id: number; name?: string }[]; width: number } {
  const layout = (
    fontKit as Font & {
      layout: (
        text: string,
        features?: unknown,
        script?: string,
        language?: string,
        direction?: string
      ) => ReturnType<Font["layout"]>;
    }
  ).layout(
    run.text,
    ["liga", "calt", "rlig", "mark", "mkmk"],
    run.script === "arabic" ? "arab" : "latn",
    run.script === "arabic" ? "AR" : "EN",
    run.script === "arabic" ? "rtl" : "ltr"
  );
  const scale = 1000 / fontKit.unitsPerEm;
  let width = 0;
  for (const glyph of layout.glyphs) {
    width += glyph.advanceWidth * scale;
  }
  return { glyphs: layout.glyphs, width };
}

export function assertRunHasNoNotdefGlyphs(
  run: TextRun,
  fontKit: Font,
  context: string
): void {
  const { glyphs } = layoutRunWithFontkit(run, fontKit);
  const missing = glyphs.filter(
    (g) => g.id === 0 || g.name === ".notdef" || g.name === ".notdef "
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing glyphs in ${context} for run ${JSON.stringify(run.text)} (${missing.length} .notdef)`
    );
  }
}

function measureRunWidth(
  run: TextRun,
  fonts: OfficialPdfFonts,
  fontSize: number
): number {
  if (run.script === "arabic") {
    return measureHarfbuzzTextWidth(
      fonts.arabicHb,
      run.text,
      "rtl",
      fontSize
    );
  }
  return fonts.latin.widthOfTextAtSize(run.text, fontSize);
}

export function measureVisualLineWidth(
  logicalLine: string,
  fonts: OfficialPdfFonts,
  fontSize: number
): number {
  const runs = orderRunsForRtlLine(parseTextRuns(logicalLine));
  return runs.reduce(
    (sum, run) => sum + measureRunWidth(run, fonts, fontSize),
    0
  );
}

export function wrapLogicalParagraph(
  paragraph: string,
  maxWidth: number,
  fonts: OfficialPdfFonts,
  fontSize: number,
  direction: "rtl" | "ltr"
): string[] {
  const cleaned = stripBidiControls(paragraph);
  if (!cleaned.trim()) return [""];

  if (direction === "ltr") {
    return wrapByWords(cleaned, maxWidth, (line) =>
      fonts.latin.widthOfTextAtSize(line, fontSize)
    );
  }

  return wrapByWords(cleaned, maxWidth, (line) =>
    measureVisualLineWidth(line, fonts, fontSize)
  );
}

function wrapByWords(
  text: string,
  maxWidth: number,
  measure: (line: string) => number
): string[] {
  const tokens = text.split(/(\s+)/);
  const lines: string[] = [];
  let current = "";
  for (const token of tokens) {
    if (!token) continue;
    const candidate = current + token;
    if (current && measure(candidate) > maxWidth) {
      lines.push(current.replace(/\s+$/, ""));
      current = token.trimStart() ? token : "";
    } else {
      current = candidate;
    }
  }
  if (current.replace(/\s+$/, "")) {
    lines.push(current.replace(/\s+$/, ""));
  }
  return lines.length > 0 ? lines : [""];
}

export function drawRtlVisualLine(
  page: PDFPage,
  logicalLine: string,
  fonts: OfficialPdfFonts,
  options: {
    xRight: number;
    y: number;
    fontSize: number;
    color?: ReturnType<typeof rgb>;
    opacity?: number;
    rotate?: Rotation;
  }
): void {
  const runs = orderRunsForRtlLine(parseTextRuns(logicalLine));
  const fontSize = options.fontSize;
  let x =
    options.xRight -
    measureVisualLineWidth(logicalLine, fonts, fontSize);

  for (const run of runs) {
    const width = measureRunWidth(run, fonts, fontSize);
    if (run.script === "arabic") {
      drawHarfbuzzTextLine(page, fonts.arabicHb, run.text, "rtl", {
        x,
        y: options.y,
        fontSize,
        color: options.color,
        opacity: options.opacity,
        rotate: options.rotate,
      });
    } else {
      page.drawText(run.text, {
        x,
        y: options.y,
        size: fontSize,
        font: fonts.latin,
        color: options.color ?? rgb(0.1, 0.1, 0.1),
        opacity: options.opacity,
        rotate: options.rotate,
      });
    }
    x += width;
  }
}

export function drawLtrLine(
  page: PDFPage,
  line: string,
  fonts: OfficialPdfFonts,
  options: {
    xLeft: number;
    y: number;
    fontSize: number;
    color?: ReturnType<typeof rgb>;
  }
): void {
  page.drawText(stripBidiControls(line), {
    x: options.xLeft,
    y: options.y,
    size: options.fontSize,
    font: fonts.latin,
    color: options.color ?? rgb(0.1, 0.1, 0.1),
  });
}

export function validateArabicLogicalLine(
  logicalLine: string,
  fonts: OfficialPdfFonts,
  context: string
): void {
  for (const run of parseTextRuns(logicalLine)) {
    if (run.script === "neutral" && !run.text.trim()) continue;
    if (run.script === "arabic") {
      assertHarfbuzzTextHasGlyphs(fonts.arabicHb, run.text, "rtl", context);
    } else {
      const layout = fonts.latinFontKit.layout(run.text);
      const missing = layout.glyphs.filter((g: { id: number }) => g.id === 0);
      if (missing.length > 0) {
        throw new Error(
          `Missing glyphs in ${context} for run ${JSON.stringify(run.text)}`
        );
      }
    }
  }
}
