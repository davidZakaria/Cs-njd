/**
 * Capture before/after walkthrough proof screenshots (fake DB only).
 * Requires dev server + seed-screenshot-data.ts.
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { authenticator } from "otplib";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT_ROOT = "/opt/cursor/artifacts";
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const UNIT_ID = process.env.WALKTHROUGH_UNIT_ID?.trim();
const PHASE = process.env.CAPTURE_PHASE ?? "after"; // "before" | "after"

async function login(page: import("playwright").Page, locale: "en" | "ar") {
  await page.goto(`${BASE_URL}/${locale}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill("demo-cs@test.local");
  await page.locator('input[name="password"]').fill("TestPassword1234!");
  await Promise.all([
    page.waitForURL(/\/(en|ar)\/(setup-2fa|verify-2fa|dashboard|units)/, {
      timeout: 90_000,
    }),
    page.locator('form button[type="submit"]').click(),
  ]);
  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(TOTP_SECRET);
    const tokenInput = page.locator("#token");
    await tokenInput.fill("");
    await tokenInput.pressSequentially(code, { delay: 30 });
    await Promise.all([
      page.waitForURL(/\/(en|ar)\/(dashboard|units|cases)/, { timeout: 90_000 }),
      page.getByRole("button", { name: /continue|متابعة/i }).click(),
    ]);
  }
}

async function main() {
  if (!UNIT_ID) throw new Error("Set WALKTHROUGH_UNIT_ID");
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  for (const locale of ["en", "ar"] as const) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
    });
    const page = await context.newPage();
    await login(page, locale);

    await page.goto(`${BASE_URL}/${locale}/units/${UNIT_ID}?tab=client`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await page.screenshot({
      path: path.join(
        ARTIFACT_ROOT,
        `walkthrough-unit-${locale}-owners-${PHASE}.png`
      ),
      fullPage: true,
    });

    await page.goto(`${BASE_URL}/${locale}/units/${UNIT_ID}?tab=timeline`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await page.screenshot({
      path: path.join(
        ARTIFACT_ROOT,
        `walkthrough-unit-${locale}-timeline-${PHASE}.png`
      ),
      fullPage: true,
    });

    if (locale === "ar") {
      await page.goto(`${BASE_URL}/ar/dashboard`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await page.screenshot({
        path: path.join(ARTIFACT_ROOT, "walkthrough-dashboard-ar.png"),
        fullPage: true,
      });

      await page.goto(`${BASE_URL}/ar/cases`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await page.screenshot({
        path: path.join(ARTIFACT_ROOT, "walkthrough-cases-ar-pagination.png"),
        fullPage: true,
      });

      await page.goto(`${BASE_URL}/ar/units`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      const search = page.locator('input[type="search"], input[placeholder]').first();
      await search.fill("٩٦٥٩٩٠٣٤٨٣٠");
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(ARTIFACT_ROOT, "walkthrough-units-search-ar-indic-digits.png"),
        fullPage: true,
      });
      const rowVisible = await page
        .getByText("WALK-DEMO-AR", { exact: false })
        .first()
        .isVisible()
        .catch(() => false);
      if (!rowVisible) {
        console.warn("Search with Arabic-Indic digits did not surface WALK-DEMO-AR");
        process.exitCode = 1;
      } else {
        console.log("Search with Arabic-Indic digits matched WALK-DEMO-AR");
      }
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