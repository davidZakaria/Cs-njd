/**
 * Playwright smoke: dashboard KPI links land on lists whose totals match the card count.
 * Uses seeded demo data (scripts/seed-dashboard-parity-demo.ts).
 */
import { chromium, type Page } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const LOCALE = process.env.E2E_LOCALE ?? "en";

async function cardCount(page: Page, labelPattern: RegExp): Promise<number> {
  const card = page.locator("a").filter({ has: page.getByText(labelPattern) }).first();
  const valueText = await card.locator(".tabular-nums").first().textContent();
  const n = Number((valueText ?? "0").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function listTotal(page: Page): Promise<number> {
  const results = page.getByText(/showing|results/i).first();
  await results.waitFor({ timeout: 15_000 });
  const text = (await results.textContent()) ?? "";
  const match = text.match(/of\s+([\d,]+)/i) ?? text.match(/(\d[\d,]*)\s+results/i);
  if (!match) throw new Error(`Could not parse list total from: ${text}`);
  return Number(match[1].replace(/,/g, ""));
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const failures: string[] = [];

  const checks: Array<{ path: string; label: RegExp }> = [
    { path: `/${LOCALE}/dashboard`, label: /legal disputes|نزاع/i },
    { path: `/${LOCALE}/executive`, label: /unassigned|غير مع/i },
  ];

  for (const check of checks) {
    await page.goto(`${BASE}${check.path}`, { waitUntil: "networkidle" });
    const expected = await cardCount(page, check.label);
    await page.locator("a").filter({ has: page.getByText(check.label) }).first().click();
    await page.waitForURL(/\/(units|cases)/);
    const actual = await listTotal(page);
    if (expected !== actual) {
      failures.push(`${check.path} → ${page.url()}: card=${expected} list=${actual}`);
    }
  }

  await browser.close();
  if (failures.length) {
    console.error("Dashboard parity failures:\n" + failures.join("\n"));
    process.exit(1);
  }
  console.log("Dashboard metric parity e2e: OK");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});