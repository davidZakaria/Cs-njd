/**
 * Screenshots for overdue-tasks + cases sticky header walkthrough.
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { authenticator } from "otplib";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT_ROOT = "/opt/cursor/artifacts";
const PHASE = process.env.CAPTURE_PHASE ?? "after";
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

async function loginManagement(page: import("playwright").Page, locale: "en" | "ar") {
  await page.goto(`${BASE_URL}/${locale}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill("demo-mgmt@test.local");
  await page.locator('input[name="password"]').fill("TestPassword1234!");
  const submit = page.locator('form button[type="submit"]');
  await Promise.all([
    page.waitForURL(/\/(en|ar)\/(setup-2fa|verify-2fa|executive|dashboard)/, {
      timeout: 90_000,
    }),
    submit.click(),
  ]);
  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(TOTP_SECRET);
    await page.locator("#token").fill(code);
    await Promise.all([
      page.waitForURL(/\/(en|ar)\/(executive|dashboard)/, { timeout: 90_000 }),
      page.getByRole("button", { name: /continue|متابعة/i }).click(),
    ]);
  }
}

async function loginCs(page: import("playwright").Page, locale: "en" | "ar") {
  await page.goto(`${BASE_URL}/${locale}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill("demo-cs@test.local");
  await page.locator('input[name="password"]').fill("TestPassword1234!");
  const submit = page.locator('form button[type="submit"]');
  await Promise.all([
    page.waitForURL(/\/(en|ar)\/(verify-2fa|dashboard|cases)/, { timeout: 90_000 }),
    submit.click(),
  ]);
  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(TOTP_SECRET);
    await page.locator("#token").fill(code);
    await Promise.all([
      page.waitForURL(/\/(en|ar)\/(dashboard|cases)/, { timeout: 90_000 }),
      page.getByRole("button", { name: /continue|متابعة/i }).click(),
    ]);
  }
}

async function main() {
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const locale of ["en", "ar"] as const) {
    const overdueContext = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
      viewport: { width: 1280, height: 900 },
    });
    const overduePage = await overdueContext.newPage();
    await loginManagement(overduePage, locale);
    await overduePage.goto(`${BASE_URL}/${locale}/executive/overdue-tasks?stage=CONTRACT`, {
      waitUntil: "domcontentloaded",
    });
    await overduePage.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await overduePage.screenshot({
      path: path.join(ARTIFACT_ROOT, `overdue-contract-tasks-${locale}-${PHASE}.png`),
      fullPage: true,
    });
    await overdueContext.close();

    const casesContext = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
      viewport: { width: 1280, height: 900 },
    });
    const casesPage = await casesContext.newPage();
    await loginCs(casesPage, locale);
    await casesPage.goto(`${BASE_URL}/${locale}/cases`, {
      waitUntil: "domcontentloaded",
    });
    await casesPage.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    const tableViewport = casesPage.locator("[data-cases-table-scroll]").first();
    if (await tableViewport.count()) {
      await tableViewport.evaluate((el) => {
        el.scrollTop = 120;
      });
    }
    await casesPage.screenshot({
      path: path.join(ARTIFACT_ROOT, `cases-sticky-header-${locale}-${PHASE}.png`),
      fullPage: false,
    });
    await casesContext.close();
  }

  await browser.close();
  console.log(`Saved screenshots to ${ARTIFACT_ROOT} (${PHASE})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});