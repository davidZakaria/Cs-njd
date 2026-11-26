/**
 * Screenshot audit change details drawer with resolved user names.
 */
import fs from "fs";
import path from "path";
import { chromium, type Page } from "playwright";
import { authenticator } from "otplib";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT_ROOT = "/opt/cursor/artifacts";
const TEST_PASSWORD = "AuditDemo1234!";
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

async function loginSuperAdmin(page: Page) {
  await page.goto(`${BASE_URL}/en/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill("audit-demo-super@test.local");
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  const submit = page.locator('form button[type="submit"]');
  await Promise.all([
    page.waitForURL(/\/(en|ar)\/(verify-2fa|audit-logs|dashboard)/, {
      timeout: 90_000,
    }),
    submit.click(),
  ]);
  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(TOTP_SECRET);
    await page.locator("#token").pressSequentially(code, { delay: 30 });
    await Promise.all([
      page.waitForURL(/\/(en|ar)\/(audit-logs|dashboard)/, { timeout: 90_000 }),
      page.getByRole("button", { name: /continue/i }).click(),
    ]);
  }
}

async function main() {
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await loginSuperAdmin(page);
  await page.goto(`${BASE_URL}/en/audit-logs`, { waitUntil: "networkidle" });

  const createTicketRow = page.locator('[data-audit-entry="Ticket:CREATE"]').first();
  await createTicketRow.waitFor({ state: "visible", timeout: 60_000 });
  await createTicketRow.getByRole("button", { name: /details|view/i }).click();

  const sheet = page.locator('[role="dialog"], [data-slot="sheet-content"]').last();
  await sheet.waitFor({ state: "visible", timeout: 30_000 });
  await sheet.screenshot({
    path: path.join(ARTIFACT_ROOT, "audit_change_details_resolved_names_en.png"),
  });

  await browser.close();
  console.log(`Audit change-details screenshot → ${ARTIFACT_ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});