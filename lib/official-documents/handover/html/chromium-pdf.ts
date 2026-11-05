import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { chromium, type Browser } from "playwright";

let browserPromise: Promise<Browser> | null = null;

function resolveChromiumExecutablePath(): string | undefined {
  const fromEnv =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() ||
    process.env.CHROME_PATH?.trim();
  return fromEnv || undefined;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      executablePath: resolveChromiumExecutablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=none",
      ],
    });
  }
  return browserPromise;
}

export async function renderHandoverHtmlToPdf(html: string): Promise<Uint8Array> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return new Uint8Array(pdf);
  } finally {
    await page.close();
  }
}

export async function renderHandoverHtmlPageOnePng(html: string): Promise<Uint8Array> {
  const browser = await getBrowser();
  const page = await browser.newPage({
    viewport: { width: 794, height: 1123 },
  });
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    const png = await page.screenshot({
      type: "png",
      fullPage: false,
      clip: { x: 0, y: 0, width: 794, height: 1123 },
    });
    return new Uint8Array(png);
  } finally {
    await page.close();
  }
}

export async function closeHandoverPdfBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    browserPromise = null;
    await browser.close();
  }
}

/** Rasterize every PDF page to PNG files (requires poppler `pdftoppm`). */
export function renderPdfBufferToPngPages(
  pdf: Uint8Array,
  outDir: string,
  filePrefix: string
): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const tmpPdf = path.join(
    os.tmpdir(),
    `handover-${filePrefix}-${Date.now()}.pdf`
  );
  fs.writeFileSync(tmpPdf, pdf);
  const outPrefix = path.join(outDir, filePrefix);
  try {
    execFileSync("pdftoppm", ["-png", "-r", "150", tmpPdf, outPrefix], {
      stdio: "pipe",
    });
  } finally {
    fs.unlinkSync(tmpPdf);
  }
  return fs
    .readdirSync(outDir)
    .filter(
      (name) =>
        name.startsWith(`${filePrefix}-`) && name.toLowerCase().endsWith(".png")
    )
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => path.join(outDir, name));
}
