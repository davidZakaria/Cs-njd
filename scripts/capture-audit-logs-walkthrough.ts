/**
 * Capture audit logs UI screenshots against a running dev server.
 * Prerequisites: npm run dev, npm run seed:audit-logs-demo
 */
import "dotenv/config";

import { mkdirSync } from "fs";
import path from "path";

import { authenticator } from "otplib";
import { chromium, type Page } from "playwright";

const OUT = path.join("/opt/cursor/artifacts", "audit-logs-walkthrough");
const EMAIL = "audit-demo-super@test.local";
const PASSWORD = "AuditDemo1234!";
const TOTP = "JBSWY3DPEHPK3PXP";
const BASE = process.env.AUTH_URL ?? "http://localhost:3000";

mkdirSync(OUT, { recursive: true });

async function login(page: Page, locale: "en" | "ar") {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/${locale}/login`);
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|تسجيل الدخول/i }).click();
  await page.waitForURL(/verify-2fa|dashboard|audit|force-password/, {
    timeout: 30_000,
  });
  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(TOTP);
    await page.locator("#token").fill(code);
    await page.getByRole("button", { name: /continue|متابعة/i }).click();
    await page.waitForURL(/dashboard|audit|users/, { timeout: 30_000 });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page, "en");
  await page.goto(`${BASE}/en/audit-logs`);
  await page.waitForSelector("h1");
  await page.screenshot({
    path: path.join(OUT, "audit-logs-list-en-desktop.png"),
    fullPage: true,
  });

  await page.screenshot({
    path: path.join(OUT, "audit-logs-filters-en-desktop.png"),
    fullPage: false,
  });

  await page.getByRole("row").nth(1).click();
  await page.locator('[data-slot="sheet-content"]').waitFor({
    state: "visible",
    timeout: 15_000,
  });
  await page.screenshot({
    path: path.join(OUT, "audit-diff-client-en.png"),
    fullPage: false,
  });
  await page.keyboard.press("Escape");

  await page
    .getByRole("row", { name: /password change|Password change/i })
    .first()
    .click();
  await page.locator('[data-slot="sheet-content"]').waitFor({
    state: "visible",
    timeout: 15_000,
  });
  await page.screenshot({
    path: path.join(OUT, "audit-diff-user-redacted-en.png"),
    fullPage: false,
  });
  await page.keyboard.press("Escape");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export csv/i }).click();
  const download = await downloadPromise;
  const csvPath = path.join(OUT, await download.suggestedFilename());
  await download.saveAs(csvPath);

  await context.close();

  const arContext = await browser.newContext();
  const arPage = await arContext.newPage();
  await login(arPage, "ar");
  await arPage.goto(`${BASE}/ar/audit-logs`);
  await arPage.waitForSelector("h1");
  await arPage.getByRole("row").nth(1).click();
  await arPage.locator('[data-slot="sheet-content"]').waitFor({
    state: "visible",
    timeout: 15_000,
  });
  await arPage.screenshot({
    path: path.join(OUT, "audit-diff-client-ar-rtl.png"),
    fullPage: false,
  });
  await arContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const mobilePage = await mobileContext.newPage();
  await login(mobilePage, "en");
  await mobilePage.goto(`${BASE}/en/audit-logs`);
  await mobilePage.waitForSelector("h1");
  await mobilePage.screenshot({
    path: path.join(OUT, "audit-logs-mobile-390.png"),
    fullPage: true,
  });

  await mobileContext.close();
  await browser.close();

  console.log(`Screenshots saved under ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});