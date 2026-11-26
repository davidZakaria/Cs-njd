/**
 * Captures multi-unit crown badge + tooltip (EN + AR) for PR evidence.
 * Requires: dev server, seeded screenshot data.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { authenticator } from "otplib";

const SCREENSHOTS_DIR = "/opt/cursor/artifacts";
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const UC_ONLY_UNIT_ID =
  process.env.UC_ONLY_UNIT_ID ?? "cmwxiz3wd000qjs5pulopm6kn";
const MULTI_VAR_UNIT_ID =
  process.env.MULTI_VAR_UNIT_ID ?? "cmwxizapl0002js7nld8e1vji";

const TEST_USER_EMAIL = "demo-mgmt@test.local";
const TEST_USER_PASSWORD = "TestPassword1234!";
const TEST_USER_TOTP_SECRET = "JBSWY3DPEHPK3PXP";

async function login(page, locale) {
  await page.goto(`${BASE_URL}/${locale}/login`);
  await page.waitForSelector('input[name="email"]', { timeout: 15000 });
  await page.fill('input[name="email"]', TEST_USER_EMAIL);
  await page.fill('input[name="password"]', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  let url = page.url();
  if (url.includes("verify-2fa")) {
    const code = authenticator.generate(TEST_USER_TOTP_SECRET);
    await page.waitForSelector("input#token", { timeout: 10000 });
    await page.fill("input#token", code);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.href.includes("verify-2fa"), { timeout: 15000 });
  }
  await page.waitForTimeout(1000);
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`Saved ${filepath}`);
}

async function captureLocale(browser, locale) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: locale === "ar" ? "ar-EG" : "en-US",
  });
  const page = await context.newPage();
  await login(page, locale);

  await page.goto(`${BASE_URL}/${locale}/units/${UC_ONLY_UNIT_ID}`);
  await page.waitForTimeout(2500);
  await screenshot(page, `multi-unit-crown-${locale}-b5-30`);

  const badge = page.getByText(/Owns \d|يمتلك \d/).first();
  if (await badge.isVisible({ timeout: 5000 })) {
    await badge.hover({ force: true });
    await page.waitForTimeout(1200);
    await page
      .locator('[data-slot="tooltip-content"]')
      .first()
      .waitFor({ state: "visible", timeout: 5000 })
      .catch(() => {});
    await screenshot(page, `multi-unit-crown-tooltip-${locale}`);
  }

  await page.goto(`${BASE_URL}/${locale}/units/${MULTI_VAR_UNIT_ID}`);
  await page.waitForTimeout(2000);
  await screenshot(page, `multi-unit-crown-${locale}-green-801`);

  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await captureLocale(browser, "en");
  await captureLocale(browser, "ar");
} finally {
  await browser.close();
}