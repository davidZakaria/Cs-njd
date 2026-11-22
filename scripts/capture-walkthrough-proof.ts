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
const VIEWPORT = { width: 1280, height: 800 };

async function screenshotUnitTab(
  page: Page,
  locale: string,
  tab: string,
  fileName: string
) {
  await page.goto(`${BASE_URL}/${locale}/units/${UNIT_ID}?tab=${tab}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
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

    await screenshotUnitTab(
      page,
      locale,
      "client",
      `unit-${locale}-client-${PHASE}.png`
    );

    await screenshotUnitTab(
      page,
      locale,
      "financials",
      `unit-${locale}-financials-${PHASE}.png`
    );

    await screenshotUnitTab(
      page,
      locale,
      "legal",
      `unit-${locale}-legal-${PHASE}.png`
    );

    await screenshotUnitTab(
      page,
      locale,
      "timeline",
      `unit-${locale}-timeline-${PHASE}.png`
    );

    await page.goto(`${BASE_URL}/${locale}/units/${UNIT_ID}?tab=client`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .locator('[data-locale-digit-surface="cs-summary"]')
      .waitFor({ state: "visible", timeout: 15_000 });
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, `unit-${locale}-cs-summary-${PHASE}.png`),
      fullPage: false,
    });

    await page.goto(`${BASE_URL}/${locale}/cases`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, `cases-${locale}-${PHASE}.png`),
      fullPage: false,
    });

    if (REQUEST_ID) {
      await page.goto(`${BASE_URL}/${locale}/requests/${REQUEST_ID}`, {
        waitUntil: "domcontentloaded",
      });
    } else {
      await page.goto(`${BASE_URL}/${locale}/requests`, {
        waitUntil: "domcontentloaded",
      });
    }
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, `requests-${locale}-${PHASE}.png`),
      fullPage: false,
    });

  if (locale === "ar" && PHASE === "after") {
      await page.goto(`${BASE_URL}/ar/units`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      const search = page.locator('input[type="search"], input[placeholder]').first();
      await search.fill("٩٦٥٩٩٠٣٤٨٣٠");
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(
          ARTIFACT_ROOT,
          "walkthrough-units-search-ar-indic-digits.png"
        ),
        fullPage: false,
      });
    }

    await context.close();
  }

  await browser.close();
  console.log(`Capture phase "${PHASE}" complete → ${ARTIFACT_ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});