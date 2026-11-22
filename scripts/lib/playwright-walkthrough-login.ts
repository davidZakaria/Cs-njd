import type { Page } from "playwright";
import { authenticator } from "otplib";

const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

/** Client-side NextAuth login — wait for hydration so the form does not GET-submit. */
export async function loginWalkthroughCsAgent(
  page: Page,
  baseUrl: string,
  locale: "en" | "ar"
) {
  await page.goto(`${baseUrl}/${locale}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle").catch(() => {});

  await page.locator('input[name="email"]').fill("demo-cs@test.local");
  await page.locator('input[name="password"]').fill("TestPassword1234!");
  const submit = page.locator('form button[type="submit"]');
  await submit.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => !document.querySelector('form button[type="submit"]')?.hasAttribute("disabled")
  );
  await Promise.all([
    page.waitForURL(
      /\/(en|ar)\/(setup-2fa|verify-2fa|dashboard|units|cases)/,
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
      page.waitForURL(/\/(en|ar)\/(dashboard|units|cases)/, { timeout: 90_000 }),
      page.getByRole("button", { name: /continue|متابعة/i }).click(),
    ]);
  }
}