import { authenticator } from "otplib";
import type { Page } from "@playwright/test";

import type { StagingRoleKey } from "../../lib/staging/credentials";
import { STAGING_USERS } from "../../lib/staging/credentials";
import {
  resolveStagingPassword,
  resolveStagingTotpSecret,
} from "../../lib/staging/e2e-secrets";

export async function loginAsStagingRole(
  page: Page,
  role: StagingRoleKey,
  locale: "en" | "ar" = "en"
) {
  const { email } = STAGING_USERS[role];
  await loginWithCredentials(page, locale, email, resolveStagingPassword());
}

export async function loginWithCredentials(
  page: Page,
  locale: "en" | "ar",
  email: string,
  password: string
) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
  await page.goto(`${baseURL}/${locale}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);

  const submit = page.locator('form button[type="submit"]');
  await submit.click();

  await page.waitForURL(
    /\/(en|ar)\/(setup-2fa|verify-2fa|dashboard|units|executive|cases|requests)/,
    { timeout: 90_000 }
  );

  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(resolveStagingTotpSecret());
    const tokenInput = page.locator("#token");
    await tokenInput.fill(code);
    const continueBtn = page
      .locator("form")
      .getByRole("button", { name: /continue|متابعة/i });
    await Promise.all([
      page.waitForURL(/\/(en|ar)\/(dashboard|units|executive|cases|requests)/, {
        timeout: 90_000,
      }),
      continueBtn.click(),
    ]);
  }

  if (page.url().includes("setup-2fa")) {
    throw new Error(
      "User was sent to setup-2fa — run npm run db:seed-staging first"
    );
  }
}