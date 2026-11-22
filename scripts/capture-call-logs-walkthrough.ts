/**
 * Real-app Call Logs inbox screenshots (fake seed data).
 */
import fs from "fs";
import path from "path";
import { chromium, type Locator, type Page } from "playwright";
import { authenticator } from "otplib";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT_ROOT = "/opt/cursor/artifacts";
const TEST_PASSWORD = "TestPassword1234!";
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

async function loginUser(page: Page, locale: "en" | "ar", email: string) {
  await page.goto(`${BASE_URL}/${locale}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor({ state: "visible" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  const submit = page.locator('form button[type="submit"]');
  await submit.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => !document.querySelector('form button[type="submit"]')?.hasAttribute("disabled")
  );
  await Promise.all([
    page.waitForURL(
      /\/(en|ar)\/(setup-2fa|verify-2fa|dashboard|units|cases|notifications|executive)/,
      { timeout: 90_000 }
    ),
    submit.click(),
  ]);
  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(TOTP_SECRET);
    const tokenInput = page.locator("#token");
    await tokenInput.fill("");
    await tokenInput.pressSequentially(code, { delay: 30 });
    await Promise.all([
      page.waitForURL(
        /\/(en|ar)\/(dashboard|units|cases|notifications|executive)/,
        { timeout: 90_000 }
      ),
      page.getByRole("button", { name: /continue|متابعة/i }).click(),
    ]);
  }
}

async function screenshotLocator(locator: Locator, fileName: string) {
  await locator.waitFor({ state: "visible", timeout: 30_000 });
  await locator.screenshot({ path: path.join(ARTIFACT_ROOT, fileName) });
}

async function captureCallLogsTab(
  page: Page,
  locale: "en" | "ar",
  email: string,
  fileName: string
) {
  await loginUser(page, locale, email);
  await page.goto(`${BASE_URL}/${locale}/notifications?tab=callLogs`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("tab", { name: /call logs|سجل المكالمات/i }).waitFor();
  const panel = page.locator('[role="tabpanel"]').first();
  await screenshotLocator(panel, fileName);
}

async function main() {
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const locale of ["en", "ar"] as const) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await captureCallLogsTab(
      page,
      locale,
      "demo-mgmt@test.local",
      `call_logs_inbox_manager_${locale}.png`
    );
    await context.close();
  }

  {
    const context = await browser.newContext({
      locale: "en-US",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await captureCallLogsTab(
      page,
      "en",
      "demo-cs@test.local",
      "call_logs_inbox_cs_agent_en.png"
    );
    await context.close();
  }

  {
    const context = await browser.newContext({
      locale: "en-US",
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await captureCallLogsTab(
      page,
      "en",
      "demo-mgmt@test.local",
      "call_logs_inbox_manager_mobile_390.png"
    );
    await context.close();
  }

  await browser.close();
  console.log(`Call logs walkthrough screenshots → ${ARTIFACT_ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});