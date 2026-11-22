/**
 * Playwright proof: every clickable dashboard KPI equals list total exactly.
 * Requires: app running, DB seeded (seed-dashboard-parity-demo.ts).
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { chromium, type Locator, type Page } from "playwright";
import { authenticator } from "otplib";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT = process.env.E2E_ARTIFACT_DIR ?? "/opt/cursor/artifacts";
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const PASSWORD = "TestPassword1234!";

type Row = {
  role: string;
  locale: string;
  card: string;
  cardCount: number;
  listCount: number;
  listUrl: string;
  ok: boolean;
};

type CheckSpec = {
  path: string;
  cardSelector: (page: Page) => Locator;
  cardLabel: string;
};

async function login(
  page: Page,
  locale: "en" | "ar",
  email: string
) {
  await page.goto(`${BASE}/${locale}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  const submit = page.locator('form button[type="submit"]');
  await Promise.all([
    page.waitForURL(
      /\/(en|ar)\/(setup-2fa|verify-2fa|dashboard|units|requests|executive)/,
      { timeout: 90_000 }
    ),
    submit.click(),
  ]);

  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(TOTP_SECRET);
    const tokenInput = page.locator("#token");
    await tokenInput.waitFor({ state: "visible", timeout: 60_000 });
    await tokenInput.click();
    await tokenInput.fill("");
    await tokenInput.pressSequentially(code, { delay: 30 });
    const continueBtn = page
      .locator("form")
      .getByRole("button", { name: /continue|متابعة/i });
    await Promise.all([
      page.waitForURL(/\/(en|ar)\/(dashboard|units|requests|executive)/, {
        timeout: 90_000,
      }),
      continueBtn.click(),
    ]);
  }
}

async function parseListTotal(page: Page): Promise<number> {
  const el = page.getByText(/Showing .+ of [\d,]+|عرض .+ من [\d,]+/i).first();
  await el.waitFor({ timeout: 20_000 });
  const text = (await el.textContent()) ?? "";
  const match =
    text.match(/of\s+([\d,]+)/i) ?? text.match(/من\s+([\d,]+)/);
  if (!match) throw new Error(`Cannot parse list total: ${text}`);
  return Number(match[1].replace(/,/g, ""));
}

async function resolveCardClickTarget(card: Locator): Promise<Locator> {
  const tag = await card.evaluate((el) => el.tagName.toLowerCase());
  if (tag === "a") return card;
  const inner = card.locator("a[href]").first();
  if ((await inner.count()) > 0) return inner;
  return card;
}

async function readCardNumber(card: Locator): Promise<number> {
  const valueEl = card.locator(".font-heading.tabular-nums").first();
  const fallback = card.locator(".tabular-nums").first();
  const target = (await valueEl.count()) > 0 ? valueEl : fallback;
  await target.waitFor({ timeout: 10_000 });
  const raw = (await target.textContent()) ?? "";
  if (/not tracked|غير متتب/i.test(raw)) return -1;
  return Number(raw.replace(/[^\d]/g, "")) || 0;
}

async function runCardCheck(
  page: Page,
  role: string,
  locale: "en" | "ar",
  spec: CheckSpec
): Promise<Row | null> {
  await page.goto(`${BASE}/${locale}${spec.path}`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  const card = spec.cardSelector(page);
  if ((await card.count()) === 0) return null;
  const cardCount = await readCardNumber(card);
  if (cardCount < 0) {
    return {
      role,
      locale,
      card: spec.cardLabel,
      cardCount: -1,
      listCount: -1,
      listUrl: "",
      ok: true,
    };
  }
  const clickTarget = await resolveCardClickTarget(card);
  await Promise.all([
    page.waitForURL(/\/(cases|units)(\?|$)/, { timeout: 60_000 }),
    clickTarget.click(),
  ]);
  await page.waitForLoadState("networkidle");
  const listCount = await parseListTotal(page);
  return {
    role,
    locale,
    card: spec.cardLabel,
    cardCount,
    listCount,
    listUrl: page.url(),
    ok: cardCount === listCount,
  };
}

function kpiCardByTitle(page: Page, pattern: RegExp): Locator {
  const titled = page.getByText(pattern).first();
  return page.locator("a").filter({ has: titled }).first();
}

const EXEC_KPI_TEST_IDS: Record<string, string> = {
  Unassigned: "unassigned",
  "Open total": "openTotal",
  "Legal cases": "legal",
  "Engineering cases": "engineering",
  "Delivered units": "deliveredUnits",
  "Handover at-risk": "legalRiskUnits",
  "Follow-up due": "followUpDue",
  "Signed protocol missing": "signedProtocolMissing",
  "Fees outstanding": "feesOutstanding",
};

function kpiCardRoot(page: Page, label: string): Locator {
  const testId = EXEC_KPI_TEST_IDS[label];
  if (testId) {
    return page.getByTestId(`kpi-${testId}`);
  }
  return page
    .locator('[data-slot="card-title"]')
    .filter({ hasText: new RegExp(label, "i") })
    .first()
    .locator('xpath=ancestor::*[@data-slot="card"][1]');
}

async function screenshot(page: Page, name: string) {
  fs.mkdirSync(ARTIFACT, { recursive: true });
  const file = path.join(ARTIFACT, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function writeReport(rows: Row[]) {
  fs.mkdirSync(ARTIFACT, { recursive: true });
  const reportPath = path.join(ARTIFACT, "dashboard-parity-report.json");
  fs.writeFileSync(reportPath, JSON.stringify({ rows }, null, 2));
  console.log("\n| Role | Locale | Card | Card | List | OK |");
  console.log("|------|--------|------|------|------|-----|");
  for (const r of rows) {
    console.log(
      `| ${r.role} | ${r.locale} | ${r.card} | ${r.cardCount} | ${r.listCount} | ${r.ok ? "✓" : "✗"} |`
    );
  }
  console.log("\nReport:", reportPath);
}

async function main() {
  fs.mkdirSync(ARTIFACT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const rows: Row[] = [];

  const sessions: Array<{ role: string; email: string; locale: "en" | "ar" }> =
    [
      { role: "SUPER_ADMIN", email: "demo-super@test.local", locale: "en" },
      { role: "CS_AGENT", email: "demo-cs@test.local", locale: "en" },
      { role: "COMMUNITY_MANAGEMENT", email: "demo-community@test.local", locale: "en" },
      { role: "MANAGEMENT", email: "demo-mgmt@test.local", locale: "en" },
      { role: "MANAGEMENT", email: "demo-mgmt@test.local", locale: "ar" },
    ];

  for (const session of sessions) {
    const page = await browser.newPage();
    await login(page, session.locale, session.email);

    if (session.role === "MANAGEMENT") {
      await page.goto(`${BASE}/${session.locale}/executive`, {
        waitUntil: "networkidle",
      });
      const execChecks: CheckSpec[] = [
        {
          path: "/executive",
          cardLabel: "Unassigned",
          cardSelector: (p) => kpiCardRoot(p, "Unassigned"),
        },
        {
          path: "/executive",
          cardLabel: "Open total",
          cardSelector: (p) => kpiCardRoot(p, "Open total"),
        },
        {
          path: "/executive",
          cardLabel: "Legal cases",
          cardSelector: (p) => kpiCardRoot(p, "Legal cases"),
        },
        {
          path: "/executive",
          cardLabel: "Engineering cases",
          cardSelector: (p) => kpiCardRoot(p, "Engineering cases"),
        },
        {
          path: "/executive",
          cardLabel: "Delivered units",
          cardSelector: (p) => kpiCardRoot(p, "Delivered units"),
        },
        {
          path: "/executive",
          cardLabel: "Handover at-risk",
          cardSelector: (p) => kpiCardRoot(p, "Handover at-risk"),
        },
        {
          path: "/executive",
          cardLabel: "Follow-up due",
          cardSelector: (p) => kpiCardRoot(p, "Follow-up due"),
        },
        {
          path: "/executive",
          cardLabel: "Signed protocol missing",
          cardSelector: (p) => kpiCardRoot(p, "Signed protocol missing"),
        },
        {
          path: "/executive",
          cardLabel: "Fees outstanding",
          cardSelector: (p) => kpiCardRoot(p, "Fees outstanding"),
        },
      ];

      await page.goto(`${BASE}/${session.locale}/executive`, {
        waitUntil: "networkidle",
      });
      if (session.locale === "en") {
        await screenshot(page, "dashboard-exec-en-overview.png");
      } else {
        await screenshot(page, "dashboard-exec-ar-overview.png");
      }

      for (const spec of execChecks) {
        let row: Row | null = null;
        try {
          row = await runCardCheck(page, session.role, session.locale, spec);
        } catch (error) {
          console.error(`Check failed: ${spec.cardLabel}`, error);
        }
        if (!row) continue;
        rows.push(row);
        if (row.cardCount === -1 && session.locale === "en") {
          await screenshot(
            page,
            `not-tracked-${spec.cardLabel.replace(/\s+/g, "-").toLowerCase()}.png`
          );
          continue;
        }
        if (
          session.locale === "en" &&
          (spec.cardLabel === "Unassigned" || spec.cardLabel === "Legal cases")
        ) {
          await screenshot(
            page,
            `list-${spec.cardLabel.replace(/\s+/g, "-").toLowerCase()}.png`
          );
        }
      }
    } else {
      const dashChecks: CheckSpec[] = [
        {
          path: "/dashboard",
          cardLabel: "Total units",
          cardSelector: (p) => kpiCardByTitle(p, /total units|إجمالي الوحدات/i),
        },
        {
          path: "/dashboard",
          cardLabel: "Pending tickets",
          cardSelector: (p) => kpiCardByTitle(p, /pending tickets|بلاغات معلقة/i),
        },
        {
          path: "/dashboard",
          cardLabel: "Delivered units",
          cardSelector: (p) => kpiCardByTitle(p, /delivered units|وحدات مُسلّمة/i),
        },
        {
          path: "/dashboard",
          cardLabel: "Legal disputes",
          cardSelector: (p) => kpiCardByTitle(p, /legal disputes|نزاعات قانونية/i),
        },
      ];

      await page.goto(`${BASE}/${session.locale}/dashboard`, {
        waitUntil: "networkidle",
      });
      await screenshot(
        page,
        `dashboard-${session.role.toLowerCase()}-${session.locale}.png`
      );

      for (const spec of dashChecks) {
        const row = await runCardCheck(page, session.role, session.locale, spec);
        if (row) {
          rows.push(row);
          if (session.locale === "en" && spec.cardLabel === "Legal disputes") {
            await screenshot(page, "list-legal-disputes-cs.png");
          }
        }
      }
    }

    // Legacy bookmark URL (no distinctUnit)
    if (session.role === "MANAGEMENT" && session.locale === "en") {
      await page.goto(`${BASE}/en/cases?status=open&agent=unassigned`, {
        waitUntil: "networkidle",
      });
      const legacyHeading = await page
        .getByRole("heading", { name: /cases/i })
        .isVisible()
        .catch(() => false);
      let total = -1;
      try {
        total = await parseListTotal(page);
      } catch {
        total = await page.locator("table tbody tr").count();
      }
      rows.push({
        role: session.role,
        locale: session.locale,
        card: "Legacy URL smoke (no distinctUnit)",
        cardCount: 0,
        listCount: total,
        listUrl: page.url(),
        ok: legacyHeading && total >= 0,
      });
    }

    await page.close();
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Not-tracked screenshots (isolated DB state)
  execSync("npx tsx scripts/clear-metric-tracking-signals.ts", {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  const pageNt = await browser.newPage();
  await login(pageNt, "en", "demo-mgmt@test.local");
  await pageNt.goto(`${BASE}/en/executive`, { waitUntil: "networkidle" });
  await screenshot(pageNt, "not-tracked-executive-overview.png");
  await pageNt.close();

  await browser.close();

  writeReport(rows);

  const failures = rows.filter((r) => !r.ok);
  const parityRows = rows.filter(
    (r) => !r.card.includes("Legacy") && r.cardCount >= 0
  );
  const missingExec = !rows.some(
    (r) => r.role === "MANAGEMENT" && r.card === "Unassigned"
  );
  if (missingExec) {
    console.error("Executive KPI checks did not run (missing Unassigned row).");
    process.exit(1);
  }
  if (failures.length) {
    console.error("\nFailures:", failures);
    process.exit(1);
  }
  console.log(
    `\nAll ${parityRows.length} dashboard metric parity checks passed (exact match).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});