/**
 * Capture before/after walkthrough proof screenshots (fake DB only).
 * Requires dev server + seed-walkthrough-fixtures.ts.
 */
import fs from "fs";
import path from "path";
import { chromium, type Page } from "playwright";
import { loginWalkthroughCsAgent } from "./lib/playwright-walkthrough-login";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT_ROOT = "/opt/cursor/artifacts";
const UNIT_ID = process.env.WALKTHROUGH_UNIT_ID?.trim();
const REQUEST_ID = process.env.WALKTHROUGH_REQUEST_ID?.trim();
const PHASE = process.env.CAPTURE_PHASE ?? "after"; // "before" | "after"
const VIEWPORT_WIDTH = Number(process.env.CAPTURE_VIEWPORT_WIDTH ?? 1280);
const VIEWPORT = { width: VIEWPORT_WIDTH, height: 800 };

async function screenshotUnitLegal(page: Page, locale: string, fileName: string) {
  await page.goto(`${BASE_URL}/${locale}/units/${UNIT_ID}?tab=legal`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page
    .locator('[data-locale-digit-surface="cs-summary"]')
    .waitFor({ state: "visible", timeout: 15_000 });
  await page.screenshot({
    path: path.join(ARTIFACT_ROOT, fileName),
    fullPage: false,
  });
}

async function main() {
  if (!UNIT_ID) throw new Error("Set WALKTHROUGH_UNIT_ID");
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  for (const locale of ["en", "ar"] as const) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
      viewport: VIEWPORT,
    });
    const page = await context.newPage();
    await loginWalkthroughCsAgent(page, BASE_URL, locale);

    await screenshotUnitLegal(
      page,
      locale,
      `unit-${locale}-legal-${PHASE}.png`
    );

    await page.goto(`${BASE_URL}/${locale}/cases`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, `cases-${locale}-${PHASE}.png`),
      fullPage: false,
    });

    if (!REQUEST_ID) {
      throw new Error("Set WALKTHROUGH_REQUEST_ID for request detail capture");
    }
    await page.goto(`${BASE_URL}/${locale}/requests/${REQUEST_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, `requests-${locale}-${PHASE}.png`),
      fullPage: false,
    });

    await context.close();
  }

  await browser.close();
  console.log(`Capture phase "${PHASE}" complete → ${ARTIFACT_ROOT} (${VIEWPORT_WIDTH}px)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});