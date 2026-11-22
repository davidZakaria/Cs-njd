/**
 * Playwright: Arabic unit timeline + phone display (fake seed data only).
 *
 * Prerequisites:
 *   npx tsx scripts/seed-screenshot-data.ts
 *   export WALKTHROUGH_UNIT_ID="<from seed output>"
 *
 * Usage: npx tsx scripts/e2e-walkthrough-ar-unit-timeline.ts
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { assertNoWesternDigitsOutsideIdentifiers } from "./lib/playwright-locale-digit-assert";
import { loginWalkthroughCsAgent } from "./lib/playwright-walkthrough-login";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT_ROOT = "/opt/cursor/artifacts";
const UNIT_ID = process.env.WALKTHROUGH_UNIT_ID?.trim();
const DUP_NOTE = "ملاحظة متابعة — نفس النص في استيراد Excel";

async function main() {
  if (!UNIT_ID) {
    throw new Error("Set WALKTHROUGH_UNIT_ID from seed-screenshot-data.ts output");
  }

  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const failures: string[] = [];

  for (const locale of ["en", "ar"] as const) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
    });
    const page = await context.newPage();
    await loginWalkthroughCsAgent(page, BASE_URL, locale);

    await page.goto(`${BASE_URL}/${locale}/units/${UNIT_ID}?tab=client`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

    if (locale === "ar") {
      const summaryRoot = page.locator('[data-locale-digit-surface="cs-summary"]');
      await summaryRoot.waitFor({ state: "visible", timeout: 15_000 });
      failures.push(
        ...(await assertNoWesternDigitsOutsideIdentifiers(
          summaryRoot,
          "ar unit cs-summary header"
        ))
      );
    }

    await page.goto(`${BASE_URL}/${locale}/units/${UNIT_ID}?tab=timeline`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

    const body = await page.textContent("body");
    if (body?.includes("96599034830.0")) {
      failures.push(`${locale}: raw Excel phone suffix visible`);
    }
    if (!body?.includes("96599034830")) {
      failures.push(`${locale}: cleaned phone not visible`);
    }

    const timelineNoteCards = page
      .locator("article")
      .filter({ hasText: DUP_NOTE });
    const visibleDupCards = await timelineNoteCards.count();
    if (visibleDupCards !== 1) {
      failures.push(
        `${locale}: expected 1 timeline card for duplicate note, saw ${visibleDupCards}`
      );
    }

    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, `walkthrough-unit-timeline-${locale}.png`),
      fullPage: true,
    });

    if (locale === "ar") {
      await page.goto(`${BASE_URL}/ar/dashboard`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      const dashboardRoot = page.locator(
        '[data-locale-digit-surface="pending-work-dashboard"]'
      );
      if (await dashboardRoot.count()) {
        failures.push(
          ...(await assertNoWesternDigitsOutsideIdentifiers(
            dashboardRoot,
            "ar dashboard pending work"
          ))
        );
      }
    }

    await context.close();
  }

  await browser.close();

  if (failures.length > 0) {
    console.error("Walkthrough E2E failures:\n", failures.join("\n"));
    process.exit(1);
  }

  console.log("Walkthrough E2E passed (en + ar).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});