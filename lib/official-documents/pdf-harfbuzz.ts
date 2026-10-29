import { createRequire } from "node:module";

import type { PDFPage, Rotation } from "pdf-lib";
import { rgb } from "pdf-lib";

type HbModule = {
  createBlob: (bytes: Uint8Array) => { ptr: number; destroy: () => void };
  createFace: (blob: { ptr: number }, index: number) => {
    ptr: number;
    upem: number;
    destroy: () => void;
  };
  createFont: (face: { ptr: number }) => {
    ptr: number;
    setScale: (x: number, y: number) => void;
    glyphToPath: (glyphId: number) => string;
    destroy: () => void;
  };
  createBuffer: () => {
    ptr: number;
    addText: (text: string) => void;
    setDirection: (dir: string) => void;
    guessSegmentProperties: () => void;
    json: () => Array<{ g: number; ax: number; dx: number; dy: number }>;
    destroy: () => void;
  };
  shape: (font: { ptr: number }, buffer: { ptr: number }) => void;
};

const require = createRequire(import.meta.url);

type HbFontHandle = {
  hb: HbModule;
  font: ReturnType<HbModule["createFont"]>;
  face: ReturnType<HbModule["createFace"]>;
  blob: ReturnType<HbModule["createBlob"]>;
  upem: number;
};

export type { HbFontHandle };

let hbModulePromise: Promise<HbModule> | null = null;

async function getHbModule(): Promise<HbModule> {
  if (!hbModulePromise) {
    hbModulePromise = require("harfbuzzjs") as Promise<HbModule>;
  }
  return hbModulePromise;
}

const hbFontCache = new Map<string, HbFontHandle>();

export async function getHbFont(bytes: Uint8Array, cacheKey: string) {
  const cached = hbFontCache.get(cacheKey);
  if (cached) return cached;

  const hb = await getHbModule();
  const blob = hb.createBlob(bytes);
  const face = hb.createFace(blob, 0);
  const font = hb.createFont(face);
  const handle: HbFontHandle = {
    hb,
    font,
    face,
    blob,
    upem: face.upem ?? 1000,
  };
  hbFontCache.set(cacheKey, handle);
  return handle;
}

export type ShapedGlyph = {
  g: number;
  ax: number;
  dx: number;
  dy: number;
};

export function shapeTextWithHarfbuzz(
  handle: HbFontHandle,
  text: string,
  direction: "ltr" | "rtl"
): ShapedGlyph[] {
  const buffer = handle.hb.createBuffer();
  buffer.addText(text);
  buffer.setDirection(direction);
  buffer.guessSegmentProperties();
  handle.hb.shape(handle.font, buffer);
  const glyphs = buffer.json() as ShapedGlyph[];
  buffer.destroy();
  return glyphs;
}

export function measureHarfbuzzTextWidth(
  handle: HbFontHandle,
  text: string,
  direction: "ltr" | "rtl",
  fontSize: number
): number {
  handle.font.setScale(1000, 1000);
  const glyphs = shapeTextWithHarfbuzz(handle, text, direction);
  return glyphs.reduce((sum, glyph) => sum + glyph.ax, 0) * (fontSize / handle.upem);
}

export function drawHarfbuzzTextLine(
  page: PDFPage,
  handle: HbFontHandle,
  text: string,
  direction: "ltr" | "rtl",
  options: {
    x: number;
    y: number;
    fontSize: number;
    color?: ReturnType<typeof rgb>;
    opacity?: number;
    rotate?: Rotation;
  }
): number {
  handle.font.setScale(1000, 1000);
  const glyphs = shapeTextWithHarfbuzz(handle, text, direction);
  const pathScale = options.fontSize / handle.upem;
  const totalWidth = glyphs.reduce((sum, glyph) => sum + glyph.ax, 0) * pathScale;
  let x = direction === "rtl" ? options.x + totalWidth : options.x;

  for (const glyph of glyphs) {
    if (glyph.g === 0) continue;
    if (direction === "rtl") {
      x -= glyph.ax * pathScale;
    }
    const path = handle.font.glyphToPath(glyph.g);
    if (path) {
      page.drawSvgPath(path, {
        x: x + glyph.dx * pathScale,
        y: options.y + glyph.dy * pathScale,
        scale: pathScale,
        color: options.color ?? rgb(0.1, 0.1, 0.1),
        borderWidth: 0,
        opacity: options.opacity,
        rotate: options.rotate,
      });
    }
    if (direction === "ltr") {
      x += glyph.ax * pathScale;
    }
  }

  return totalWidth;
}

export function assertHarfbuzzTextHasGlyphs(
  handle: HbFontHandle,
  text: string,
  direction: "ltr" | "rtl",
  context: string
): void {
  const glyphs = shapeTextWithHarfbuzz(handle, text, direction);
  const missing = glyphs.filter((g) => g.g === 0);
  if (missing.length > 0) {
    throw new Error(
      `Missing harfbuzz glyphs in ${context} for ${JSON.stringify(text)}`
    );
  }
  for (const glyph of glyphs) {
    const path = handle.font.glyphToPath(glyph.g);
    if (!path) {
      throw new Error(
        `Empty glyph path in ${context} for ${JSON.stringify(text)} (id ${glyph.g})`
      );
    }
  }
}
