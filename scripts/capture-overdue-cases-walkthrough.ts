/**
 * Screenshots for overdue-tasks + cases sticky header walkthrough.
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { chromium } from "playwright";
import { authenticator } from "otplib";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT_ROOT = "/opt/cursor/artifacts";
const PHASE = process.env.CAPTURE_PHASE ?? "after";
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

const VIEWPORTS: Array<{ width: number; height: number; suffix: string }> = [
  { width: 1280, height: 800, suffix: "" },
  { width: 1024, height: 800, suffix: "-1024" },
];

async function loginManagement(page: import("playwright").Page, locale: "en" | "ar") {
  await page.goto(`${BASE_URL}/${locale}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.locator('input[name="email"]').fill("demo-mgmt@test.local");
  await page.locator('input[name="password"]').fill("TestPassword1234!");
  const submit = page.locator('form button[type="submit"]');
  await submit.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => !document.querySelector('form button[type="submit"]')?.hasAttribute("disabled")
  );
  await submit.click();
  await page.waitForURL(
    /\/(en|ar)\/(setup-2fa|verify-2fa|executive|dashboard)/,
    { timeout: 90_000 }
  );
  if (page.url().includes("verify-2fa")) {
    const tokenInput = page.locator("#token");
    await tokenInput.waitFor({ state: "visible" });
    const code = authenticator.generate(TOTP_SECRET);
    await tokenInput.fill("");
    await tokenInput.pressSequentially(code, { delay: 30 });
    await page.getByRole("button", { name: /continue|متابعة/i }).click();
    await page.waitForURL(/\/(en|ar)\/(executive|dashboard)/, { timeout: 90_000 });
  }
}

function writeCleanupDryRunArtifact() {
  if (PHASE !== "after") return;
  const dryRun = execFileSync(
    "npx",
    ["tsx", "scripts/cleanup-retroactive-unit-cycle-deadlines.ts"],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
    }
  );
  fs.writeFileSync(
    path.join(ARTIFACT_ROOT, "cleanup-unit-cycle-deadlines-dry-run.txt"),
    dryRun
  );
}

async function main() {
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  writeCleanupDryRunArtifact();

  const browser = await chromium.launch({ headless: true });

  for (const locale of ["en", "ar"] as const) {
    for (const viewport of VIEWPORTS) {
      const overdueContext = await browser.newContext({
        locale: locale === "ar" ? "ar-EG" : "en-US",
        viewport: { width: viewport.width, height: viewport.height },
      });
      const overduePage = await overdueContext.newPage();
      await loginManagement(overduePage, locale);
      await overduePage.goto(`${BASE_URL}/${locale}/executive/overdue-tasks?stage=CONTRACT`, {
        waitUntil: "domcontentloaded",
      });
      await overduePage.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await overduePage
        .getByText(/Contract|العقد/)
        .first()
        .waitFor({ state: "visible", timeout: 15_000 })
        .catch(() => {});
      await overduePage.screenshot({
        path: path.join(
          ARTIFACT_ROOT,
          `overdue-contract-tasks-${locale}${viewport.suffix}-${PHASE}.png`
        ),
        fullPage: false,
      });
      await overdueContext.close();

      const casesContext = await browser.newContext({
        locale: locale === "ar" ? "ar-EG" : "en-US",
        viewport: { width: viewport.width, height: viewport.height },
      });
      const casesPage = await casesContext.newPage();
      await loginManagement(casesPage, locale);
      await casesPage.goto(`${BASE_URL}/${locale}/cases?project=green-avenue`, {
        waitUntil: "domcontentloaded",
      });
      await casesPage.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await casesPage
        .getByText(/GA-CASE|جرين|GREEN AVENUE/)
        .first()
        .waitFor({ state: "visible", timeout: 30_000 });
      await casesPage
        .locator("text=/Showing .* of [1-9]/")
        .first()
        .waitFor({ state: "visible", timeout: 15_000 })
        .catch(() => {});

      const tableViewport = casesPage.locator("[data-cases-table-scroll]").first();
      await tableViewport.evaluate((el) => {
        el.scrollTop = 220;
        el.scrollLeft = 0;
      });
      await casesPage.waitForTimeout(300);
      await casesPage.screenshot({
        path: path.join(
          ARTIFACT_ROOT,
          `cases-sticky-header-${locale}${viewport.suffix}-${PHASE}.png`
        ),
        fullPage: false,
      });
      await casesContext.close();
    }
  }

  await browser.close();
  console.log(`Saved screenshots to ${ARTIFACT_ROOT} (${PHASE})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});