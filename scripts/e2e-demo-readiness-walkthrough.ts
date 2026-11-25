/**
 * Crawl Legal / Finance / Operations routes (EN + AR, desktop + mobile) on a production build.
 * Reports console errors, HTTP failures, and embarrassing UI strings.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-readiness.ts
 *   npm run build && PORT=3000 npm run start
 *   npx tsx scripts/e2e-demo-readiness-walkthrough.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { authenticator } from "otplib";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const PASSWORD = "TestPassword1234!";
const TOTP = "JBSWY3DPEHPK3PXP";
const REPORT_PATH =
  process.env.DEMO_READINESS_REPORT ??
  path.join("/opt/cursor/artifacts", "demo-readiness-report.json");

const EMBARRASSING =
  /\b(undefined|NaN|Invalid Date)\b|unitRequestType\.|unitRequestStatus\.|enums\.|ARCHIVE_CHECK|PENDING_PARTY|Permission denied/i;

type RoleSpec = {
  role: string;
  email: string;
  paths: string[];
};

const ROLES: RoleSpec[] = [
  {
    role: "LEGAL",
    email: "demo-legal@test.local",
    paths: ["/legal", "/requests", "/requests?view=awaiting&overdue=yes", "/legal/overdue-tasks"],
  },
  {
    role: "FINANCE",
    email: "demo-finance@test.local",
    paths: [
      "/finance",
      "/requests",
      "/requests?view=awaiting&overdue=yes",
      "/finance/overdue-tasks",
    ],
  },
  {
    role: "OPERATIONS",
    email: "demo-ops@test.local",
    paths: ["/operations", "/operations/requests"],
  },
];

async function login(page: Page, locale: "en" | "ar", email: string) {
  await page.goto(`${BASE_URL}/${locale}/login`, { waitUntil: "networkidle" });
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

type Finding = {
  role: string;
  locale: string;
  viewport: string;
  path: string;
  kind: string;
  detail: string;
};

async function crawlPath(
  page: Page,
  spec: RoleSpec,
  locale: "en" | "ar",
  viewport: { width: number; height: number; label: string },
  href: string,
  findings: Finding[]
) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const url = `${BASE_URL}/${locale}${href}`;
  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  const status = response?.status() ?? 0;

  if (status >= 400) {
    findings.push({
      role: spec.role,
      locale,
      viewport: viewport.label,
      path: href,
      kind: "http",
      detail: `HTTP ${status}`,
    });
  }

  const bodyText = await page.locator("body").innerText();
  const embarrass = bodyText.match(EMBARRASSING);
  if (embarrass) {
    findings.push({
      role: spec.role,
      locale,
      viewport: viewport.label,
      path: href,
      kind: "ui-text",
      detail: embarrass[0],
    });
  }

  if (page.url().includes("/login") && !href.includes("login")) {
    findings.push({
      role: spec.role,
      locale,
      viewport: viewport.label,
      path: href,
      kind: "auth",
      detail: "Redirected to login",
    });
  }

  for (const err of [...consoleErrors, ...pageErrors].slice(0, 5)) {
    findings.push({
      role: spec.role,
      locale,
      viewport: viewport.label,
      path: href,
      kind: "console",
      detail: err.slice(0, 300),
    });
  }

  const archiveLink = page.locator('a[href*="/operations/archive-checks"]').first();
  if (spec.role === "OPERATIONS" && href === "/operations" && (await archiveLink.count()) > 0) {
    const checkHref = await archiveLink.getAttribute("href");
    if (checkHref) {
      const checkUrl = checkHref.startsWith("http")
        ? checkHref
        : `${BASE_URL}${checkHref.startsWith("/") ? "" : "/"}${checkHref}`;
      const checkResp = await page.goto(checkUrl, { waitUntil: "networkidle" });
      if ((checkResp?.status() ?? 0) >= 400) {
        findings.push({
          role: spec.role,
          locale,
          viewport: viewport.label,
          path: checkHref,
          kind: "http",
          detail: `HTTP ${checkResp?.status()}`,
        });
      }
    }
  }

  const requestRow = page.locator("table tbody tr a").first();
  if (
    (spec.role === "LEGAL" || spec.role === "FINANCE") &&
    href === "/requests" &&
    (await requestRow.count()) > 0
  ) {
    await requestRow.click();
    await page.waitForLoadState("networkidle");
    const detailText = await page.locator("body").innerText();
    const detailEmbarrass = detailText.match(EMBARRASSING);
    if (detailEmbarrass) {
      findings.push({
        role: spec.role,
        locale,
        viewport: viewport.label,
        path: `${href} → detail`,
        kind: "ui-text",
        detail: detailEmbarrass[0],
      });
    }
  }
}

async function main() {
  const findings: Finding[] = [];
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { width: 1280, height: 900, label: "desktop" },
    { width: 390, height: 844, label: "mobile" },
  ];

  for (const spec of ROLES) {
    for (const locale of ["en", "ar"] as const) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, locale, spec.email);

      for (const viewport of viewports) {
        for (const href of spec.paths) {
          await crawlPath(page, spec, locale, viewport, href, findings);
        }
      }
      await context.close();
    }
  }

  await browser.close();

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify({ baseUrl: BASE_URL, findings, at: new Date().toISOString() }, null, 2)
  );

  const errors = findings.filter((f) => f.kind !== "console" || !f.detail.includes("favicon"));
  console.log(`Findings: ${findings.length} (material: ${errors.length})`);
  console.log(`Report: ${REPORT_PATH}`);
  if (errors.some((f) => f.kind === "http" || f.kind === "auth" || f.kind === "ui-text")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});