/**
 * Capture 2FA reset walkthrough screenshots (EN + AR) against production server.
 *   npm run build && npm run start
 *   npx tsx scripts/seed-2fa-reset-walkthrough.ts
 *   npx tsx scripts/capture-2fa-reset-walkthrough.ts
 */
import "dotenv/config";

import { mkdirSync } from "fs";
import path from "path";

import { authenticator } from "otplib";
import { chromium, type Page } from "playwright";

const OUT = path.join("/opt/cursor/artifacts", "2fa-reset-walkthrough");
const BASE = process.env.AUTH_URL ?? "http://localhost:3000";

const STALE = {
  email: "2fa-stale-agent@test.local",
  password: "Walkthrough123!",
  totp: "JBSWY3DPEHPK3PXP",
};
const PENDING = {
  email: "2fa-pending-agent@test.local",
  password: "Walkthrough123!",
  totp: "JBSWY3DPEHPK3PXP",
};
const SUPER = {
  email: "2fa-walk-super@test.local",
  password: "Walkthrough123!",
  totp: "JBSWY3DPEHPK3PXP",
};

mkdirSync(OUT, { recursive: true });

async function loginToVerify(page: Page, locale: "en" | "ar", creds: typeof STALE) {
  await page.goto(`${BASE}/${locale}/login`);
  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /sign in|تسجيل الدخول/i }).click();
  await page.waitForURL(/verify-2fa|setup-2fa/, { timeout: 45_000 });
  if (!page.url().includes("verify-2fa")) {
    throw new Error(`Expected verify-2fa, got ${page.url()}`);
  }
  await page.waitForTimeout(2500);
}

async function loginSuper(page: Page, locale: "en" | "ar") {
  await page.goto(`${BASE}/${locale}/login`);
  await page.locator("#email").fill(SUPER.email);
  await page.locator("#password").fill(SUPER.password);
  await page.getByRole("button", { name: /sign in|تسجيل الدخول/i }).click();
  await page.waitForURL(/verify-2fa|users|dashboard/, { timeout: 45_000 });
  if (page.url().includes("verify-2fa")) {
    await page.locator("#token").fill(authenticator.generate(SUPER.totp));
    await page.getByRole("button", { name: /continue|متابعة/i }).click();
    await page.waitForURL(/users|dashboard|2fa/, { timeout: 30_000 });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const locale of ["en", "ar"] as const) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginToVerify(page, locale, STALE);
    await page.screenshot({
      path: path.join(OUT, `verify-stale-approval-${locale}.png`),
      fullPage: true,
    });
    await page.close();
  }

  for (const locale of ["en", "ar"] as const) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginToVerify(page, locale, PENDING);
    await page
      .getByText(/waiting for super admin approval|بانتظار موافقة المسؤول الأعلى/i)
      .waitFor({ timeout: 20_000 });
    await page.screenshot({
      path: path.join(OUT, `verify-pending-reset-${locale}.png`),
      fullPage: true,
    });
    await page.close();
  }

  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginSuper(page, "en");
    await page.goto(`${BASE}/en/users/2fa-requests`);
    await page.getByText(/recently completed resets|2FA reset requests/i).first().waitFor({
      timeout: 45_000,
    });
    await page.screenshot({
      path: path.join(OUT, "2fa-requests-consumed-en.png"),
      fullPage: true,
    });
    await page.close();
  }

  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/en/login`);
    await page.locator("#email").fill("2fa-approved-setup@test.local");
    await page.locator("#password").fill("Walkthrough123!");
    await page.getByRole("button", { name: /sign in|تسجيل الدخول/i }).click();
    await page.waitForURL(/setup-2fa|verify-2fa/, { timeout: 45_000 });
    if (page.url().includes("verify-2fa")) {
      await page.waitForTimeout(4000);
    }
    if (!page.url().includes("setup-2fa")) {
      await page.goto(`${BASE}/en/setup-2fa`);
    }
    await page.getByText(/set up two-factor|إعداد المصادقة/i).first().waitFor({
      timeout: 30_000,
    });
    await page.screenshot({
      path: path.join(OUT, "setup-after-approval-en.png"),
      fullPage: true,
    });
    await page.close();
  }

  await browser.close();
  console.log(`Screenshots written to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});