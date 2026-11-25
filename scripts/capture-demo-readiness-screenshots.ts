/**
 * Capture demo screenshots per department role (EN home + AR home + key screens).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { authenticator } from "otplib";

const BASE_URL = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:3000";
const ROOT = "/opt/cursor/artifacts/demo-readiness";
const PASSWORD = "TestPassword1234!";
const TOTP = "JBSWY3DPEHPK3PXP";

type Shot = { file: string; path: string };

const MATRIX: Array<{
  role: string;
  email: string;
  shots: Shot[];
}> = [
  {
    role: "legal",
    email: "demo-legal@test.local",
    shots: [
      { file: "home-en.png", path: "/en/legal" },
      { file: "home-ar.png", path: "/ar/legal" },
      { file: "requests-awaiting-en.png", path: "/en/requests?view=awaiting" },
      { file: "overdue-tasks-en.png", path: "/en/legal/overdue-tasks" },
    ],
  },
  {
    role: "finance",
    email: "demo-finance@test.local",
    shots: [
      { file: "home-en.png", path: "/en/finance" },
      { file: "home-ar.png", path: "/ar/finance" },
      { file: "requests-awaiting-en.png", path: "/en/requests?view=awaiting" },
      { file: "overdue-tasks-en.png", path: "/en/finance/overdue-tasks" },
    ],
  },
  {
    role: "operations",
    email: "demo-ops@test.local",
    shots: [
      { file: "home-en.png", path: "/en/operations" },
      { file: "home-ar.png", path: "/ar/operations" },
      { file: "archive-inbox-en.png", path: "/en/operations/requests" },
    ],
  },
];

async function login(page: Page, url: string, email: string) {
  const locale = url.includes("/ar/") ? "ar" : "en";
  await page.goto(`${BASE_URL}/${locale}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForSelector('input[name="email"]', { timeout: 60_000 });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1200);
  if (page.url().includes("verify-2fa")) {
    await page.fill("input#token", authenticator.generate(TOTP));
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const entry of MATRIX) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const dir = path.join(ROOT, entry.role);
    fs.mkdirSync(dir, { recursive: true });

    for (const shot of entry.shots) {
      if (shot.file === entry.shots[0]!.file) {
        await login(page, shot.path, entry.email);
      }
      await page.goto(`${BASE_URL}${shot.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.waitForTimeout(500);
      const out = path.join(dir, shot.file);
      await page.screenshot({ path: out, fullPage: true });
      console.log(out);
    }

    await context.close();
  }

  await browser.close();
  console.log(`Screenshots saved under ${ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});