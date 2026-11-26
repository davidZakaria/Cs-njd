/**
 * Screenshots: community dashboard calls logged + call logs tab (Arabic notes).
 */
import fs from "fs";
import path from "path";
import { chromium, type Page } from "playwright";
import { authenticator } from "otplib";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT_ROOT = "/opt/cursor/artifacts";
const TEST_PASSWORD = "TestPassword1234!";
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const COMMUNITY_EMAIL = "demo-community@test.local";

async function loginUser(page: Page, locale: "en" | "ar", email: string) {
  await page.goto(`${BASE_URL}/${locale}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  const submit = page.locator('form button[type="submit"]');
  await page.waitForFunction(
    () => !document.querySelector('form button[type="submit"]')?.hasAttribute("disabled")
  );
  await Promise.all([
    page.waitForURL(
      /\/(en|ar)\/(setup-2fa|verify-2fa|dashboard|units|cases|notifications)/,
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
      page.waitForURL(/\/(en|ar)\/(dashboard|units|cases|notifications)/, {
        timeout: 90_000,
      }),
      page.getByRole("button", { name: /continue|متابعة/i }).click(),
    ]);
  }
}

async function main() {
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  await loginUser(page, "en", COMMUNITY_EMAIL);

  await page.goto(`${BASE_URL}/en/dashboard`, { waitUntil: "networkidle" });
  await page.getByText(/calls logged/i).waitFor({ timeout: 60_000 });
  await page.screenshot({
    path: path.join(ARTIFACT_ROOT, "community_dashboard_calls_logged_en.png"),
    fullPage: false,
  });

  await page.goto(`${BASE_URL}/en/notifications?tab=callLogs`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("tab", { name: /call logs/i }).waitFor();
  const panel = page.locator('[role="tabpanel"]').first();
  await panel.waitFor({ state: "visible", timeout: 30_000 });
  await panel.screenshot({
    path: path.join(ARTIFACT_ROOT, "community_call_logs_tab_self_notification_en.png"),
  });

  await context.close();
  await browser.close();
  console.log(`Community call-fix screenshots → ${ARTIFACT_ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});