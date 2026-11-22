import { chromium } from "@playwright/test";
import { authenticator } from "otplib";
import fs from "node:fs";
import path from "node:path";

import {
  STAGING_USERS,
  STAGING_E2E_DUAL_UNIT_CODE,
} from "../lib/staging/credentials";
import {
  resolveStagingPassword,
  resolveStagingTotpSecret,
} from "../lib/staging/e2e-secrets";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const outDir =
  process.env.STAGING_SCREENSHOT_DIR ?? "/opt/cursor/artifacts";

async function login(page: import("@playwright/test").Page) {
  const { email } = STAGING_USERS.csAgent;
  await page.goto(`${baseURL}/en/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(resolveStagingPassword());
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/verify-2fa|dashboard|units/, { timeout: 60_000 });
  if (page.url().includes("verify-2fa")) {
    await page.locator("#token").fill(authenticator.generate(resolveStagingTotpSecret()));
    await page
      .locator("form")
      .getByRole("button", { name: /continue/i })
      .click();
    await page.waitForURL(/dashboard|units/, { timeout: 60_000 });
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page);
  await page.goto(`${baseURL}/en/dashboard`);
  await page
    .getByTestId("staging-environment-banner")
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.screenshot({
    path: path.join(outDir, "staging-dashboard-seed.png"),
    fullPage: true,
  });
  await page.goto(`${baseURL}/en/units`);
  await page.getByPlaceholder(/search/i).fill(STAGING_E2E_DUAL_UNIT_CODE);
  await page.screenshot({
    path: path.join(outDir, "staging-units-dual-owner-seed.png"),
    fullPage: true,
  });
  await browser.close();
  console.log("Wrote screenshots to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});