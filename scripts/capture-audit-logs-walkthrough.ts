/**
 * Capture audit logs UI screenshots against a production Next server.
 * Prerequisites:
 *   npm run build && npm run start
 *   npm run seed:audit-logs-demo
 */
import "dotenv/config";

import { mkdirSync } from "fs";
import path from "path";

import { authenticator } from "otplib";
import { chromium, type Locator, type Page } from "playwright";

const OUT = path.join("/opt/cursor/artifacts", "audit-logs-walkthrough");
const EMAIL = "audit-demo-super@test.local";
const PASSWORD = "AuditDemo1234!";
const TOTP = "JBSWY3DPEHPK3PXP";
const BASE = process.env.AUTH_URL ?? "http://localhost:3000";

mkdirSync(OUT, { recursive: true });

async function login(page: Page, locale: "en" | "ar") {
  await page.setViewportSize({ width: 1440, height: 900 });
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

async function waitForSheet(page: Page) {
  const sheet = page.locator('[data-slot="sheet-content"]');
  await sheet.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(400);
  return sheet;
}

async function screenshotSheet(page: Page, outFile: string) {
  const sheet = await waitForSheet(page);
  await sheet.screenshot({ path: path.join(OUT, outFile) });
}

async function openAuditRow(page: Page, entry: string) {
  const row = page.locator(`tr[data-audit-entry="${entry}"]`);
  await row.getByRole("button", { name: /details|التفاصيل/i }).click();
}

async function screenshotPageRegion(page: Page, outFile: string, height = 520) {
  await page.screenshot({
    path: path.join(OUT, outFile),
    clip: { x: 0, y: 0, width: 1440, height },
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage();
  await login(page, "en");
  await page.goto(`${BASE}/en/audit-logs`);
  await page.waitForSelector("h1");
  await page.waitForSelector('[data-audit-entry]');

  await page.screenshot({
    path: path.join(OUT, "audit-logs-list-en-desktop.png"),
    fullPage: true,
  });

  await screenshotPageRegion(page, "audit-logs-filters-en-desktop.png", 560);

  await openAuditRow(page, "Client:UPDATE");
  await screenshotSheet(page, "audit-diff-client-en.png");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await openAuditRow(page, "User:UPDATE");
  await screenshotSheet(page, "audit-diff-user-redacted-en.png");
  await page.keyboard.press("Escape");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export csv/i }).click();
  const download = await downloadPromise;
  await download.saveAs(
    path.join(OUT, await download.suggestedFilename())
  );

  await page.goto(`${BASE}/en/system/security`);
  await page.getByRole("tab", { name: /login history|سجل الدخول/i }).click();
  await page.waitForSelector("table tbody tr");
  await page.screenshot({
    path: path.join(OUT, "login-history-statuses-en.png"),
    fullPage: false,
  });

  await page.close();

  const arPage = await browser.newPage();
  await login(arPage, "ar");
  await arPage.goto(`${BASE}/ar/audit-logs`);
  await arPage.waitForSelector("h1");
  await screenshotPageRegion(arPage, "audit-logs-filters-ar-desktop.png", 580);
  await openAuditRow(arPage, "Client:UPDATE");
  await screenshotSheet(arPage, "audit-diff-client-ar-rtl.png");
  await arPage.close();

  const mobilePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await login(mobilePage, "en");
  await mobilePage.goto(`${BASE}/en/audit-logs`);
  await mobilePage.waitForSelector("h1");
  await mobilePage.screenshot({
    path: path.join(OUT, "audit-logs-mobile-390.png"),
    fullPage: true,
  });
  await mobilePage.close();

  await browser.close();
  console.log(`Screenshots saved under ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});