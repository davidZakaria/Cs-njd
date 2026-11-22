/**
 * Playwright: Arabic unit timeline + phone display (fake seed data only).
 *
 * Prerequisites:
 *   npx tsx scripts/seed-screenshot-data.ts
 *   export WALKTHROUGH_UNIT_ID="<from seed output>"
 *
 * Usage: npx tsx scripts/e2e-walkthrough-ar-unit-timeline.ts
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { authenticator } from "otplib";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT_ROOT = "/opt/cursor/artifacts";
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const UNIT_ID = process.env.WALKTHROUGH_UNIT_ID?.trim();
const DUP_NOTE = "ملاحظة متابعة — نفس النص في استيراد Excel";

async function login(page: import("playwright").Page, locale: "en" | "ar") {
  await page.goto(`${BASE_URL}/${locale}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill("demo-cs@test.local");
  await page.locator('input[name="password"]').fill("TestPassword1234!");
  await Promise.all([
    page.waitForURL(/\/(en|ar)\/(setup-2fa|verify-2fa|dashboard|units)/, {
      timeout: 90_000,
    }),
    page.locator('form button[type="submit"]').click(),
  ]);
  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(TOTP_SECRET);
    const tokenInput = page.locator("#token");
    await tokenInput.fill("");
    await tokenInput.pressSequentially(code, { delay: 30 });
    await Promise.all([
      page.waitForURL(/\/(en|ar)\/(dashboard|units)/, { timeout: 90_000 }),
      page.getByRole("button", { name: /continue|متابعة/i }).click(),
    ]);
  }
}

async function main() {
  if (!UNIT_ID) {
    throw new Error("Set WALKTHROUGH_UNIT_ID from seed-screenshot-data.ts output");
  }

  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const failures: string[] = [];

  for (const locale of ["en", "ar"] as const) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
    });
    const page = await context.newPage();
    await login(page, locale);

    await page.goto(`${BASE_URL}/${locale}/units/${UNIT_ID}?tab=timeline`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

    const body = await page.textContent("body");
    if (body?.includes("96599034830.0")) {
      failures.push(`${locale}: raw Excel phone suffix visible`);
    }
    if (!body?.includes("96599034830")) {
      failures.push(`${locale}: cleaned phone not visible`);
    }

    const dupCount = body?.split(DUP_NOTE).length ?? 0;
    if (dupCount - 1 !== 1) {
      failures.push(
        `${locale}: expected 1 duplicate timeline note, saw ${Math.max(0, dupCount - 1)}`
      );
    }

    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, `walkthrough-unit-timeline-${locale}.png`),
      fullPage: true,
    });

    await context.close();
  }

  await browser.close();

  if (failures.length > 0) {
    console.error("Walkthrough E2E failures:\n", failures.join("\n"));
    process.exit(1);
  }

  console.log("Walkthrough E2E passed (en + ar).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});