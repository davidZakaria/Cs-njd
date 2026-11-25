/**
 * Production-build screenshots for late-request digest walkthrough.
 * Requires: npm run build && npm run start, and seed-late-request-digest-walkthrough.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { authenticator } from "otplib";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT_ROOT = "/opt/cursor/artifacts";
const PASSWORD = "TestPassword1234!";
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

async function login(page: Page, locale: "en" | "ar", email: string) {
  await page.goto(`${BASE_URL}/${locale}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  const submit = page.locator('form button[type="submit"]');
  const postLoginUrl =
    /\/(en|ar)\/(setup-2fa|verify-2fa|dashboard|notifications|requests|system|executive)/;
  await Promise.all([
    page.waitForURL(postLoginUrl, { timeout: 90_000 }),
    submit.click(),
  ]);

  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(TOTP_SECRET);
    const tokenInput = page.locator("#token");
    await tokenInput.fill("");
    await tokenInput.pressSequentially(code, { delay: 30 });
    await Promise.all([
      page.waitForURL(
        /\/(en|ar)\/(dashboard|notifications|requests|system|executive)/,
        { timeout: 90_000 }
      ),
      page.getByRole("button", { name: /continue|متابعة/i }).click(),
    ]);
  }
}

async function screenshot(page: Page, fileName: string) {
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACT_ROOT, fileName),
    fullPage: true,
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const locale of ["en", "ar"] as const) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    await login(page, locale, "demo-mgmt@test.local");
    await page.goto(`${BASE_URL}/${locale}/notifications?tab=requests`, {
      waitUntil: "networkidle",
    });
    await screenshot(page, `late-request-digest-inbox-${locale}.png`);

    await page.goto(`${BASE_URL}/${locale}/requests?overdue=yes&view=all`, {
      waitUntil: "networkidle",
    });
    await screenshot(page, `requests-overdue-filter-${locale}.png`);

    await context.close();
  }

  for (const locale of ["en", "ar"] as const) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await login(page, locale, "demo-super@test.local");
    await page.goto(`${BASE_URL}/${locale}/system/general-settings`, {
      waitUntil: "networkidle",
    });
    await screenshot(page, `late-request-watchers-settings-${locale}.png`);
    await context.close();
  }

  const mobileWidth = 390;
  for (const locale of ["en", "ar"] as const) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
      viewport: { width: mobileWidth, height: 844 },
      isMobile: true,
    });
    const page = await context.newPage();
    await login(page, locale, "demo-mgmt@test.local");
    await page.goto(`${BASE_URL}/${locale}/notifications?tab=requests`, {
      waitUntil: "networkidle",
    });
    await screenshot(page, `late-request-digest-inbox-${locale}-mobile.png`);
    await page.goto(`${BASE_URL}/${locale}/requests?overdue=yes&view=all`, {
      waitUntil: "networkidle",
    });
    await screenshot(page, `requests-overdue-filter-${locale}-mobile.png`);
    await context.close();
  }

  for (const locale of ["en", "ar"] as const) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
      viewport: { width: mobileWidth, height: 844 },
      isMobile: true,
    });
    const page = await context.newPage();
    await login(page, locale, "demo-super@test.local");
    await page.goto(`${BASE_URL}/${locale}/system/general-settings`, {
      waitUntil: "networkidle",
    });
    await screenshot(page, `late-request-watchers-settings-${locale}-mobile.png`);
    await context.close();
  }

  await browser.close();
  console.log(`Late request walkthrough screenshots saved to ${ARTIFACT_ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});