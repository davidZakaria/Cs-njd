/**
 * Playwright matrix: edit HANDOVER_APPOINTMENT requests on two-owner unit shapes.
 * Fake data via scripts/seed-screenshot-data.ts only.
 *
 * Usage: npx tsx scripts/e2e-handover-request-edit-matrix.ts
 */
import fs from "fs";
import path from "path";
import { chromium, type Page } from "playwright";
import { authenticator } from "otplib";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT_ROOT = process.env.HANDOVER_E2E_STORE?.trim() ?? "/opt/cursor/artifacts";
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

type MatrixCase = {
  name: string;
  requestId: string;
};

type EditResult = {
  name: string;
  locale: string;
  role: string;
  ok: boolean;
  error?: string;
};

async function login(
  page: Page,
  locale: "en" | "ar",
  email: string,
  password: string
) {
  await page.goto(`${BASE_URL}/${locale}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
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

async function editDescriptionOnRequestPage(
  page: Page,
  locale: "en" | "ar",
  requestId: string,
  marker: string
): Promise<{ ok: boolean; error?: string }> {
  await page.goto(`${BASE_URL}/${locale}/requests/${requestId}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

  if (page.url().includes("/login") || page.url().includes("verify-2fa")) {
    return { ok: false, error: `Auth lost: ${page.url()}` };
  }

  const editPattern = locale === "en" ? /^edit$/i : /تعديل/;
  const savePattern = locale === "en" ? /^save$/i : /حفظ/;

  const editBtn = page.getByRole("button", { name: editPattern });
  if (!(await editBtn.isVisible().catch(() => false))) {
    return { ok: false, error: "Edit description button not visible (permissions or UI)" };
  }

  await editBtn.click();
  const textarea = page.locator("textarea").first();
  await textarea.fill(marker);

  const saveBtn = page.getByRole("button", { name: savePattern }).first();
  await saveBtn.click();
  await page.waitForTimeout(2500);

  const body = await page.textContent("body");
  if (body?.includes(marker)) {
    return { ok: true };
  }

  const toastError = await page
    .locator("[data-sonner-toast]")
    .textContent()
    .catch(() => null);
  return {
    ok: false,
    error: toastError?.trim() || "Description not persisted after save",
  };
}

function loadMatrixFromEnv(): MatrixCase[] {
  const merged = process.env.HANDOVER_MERGED_REQUEST_ID?.trim();
  const legacy = process.env.HANDOVER_LEGACY_CO_REQUEST_ID?.trim();
  const ucOnly = process.env.HANDOVER_UC_ONLY_REQUEST_ID?.trim();

  const cases: MatrixCase[] = [];
  if (merged) cases.push({ name: "merged_slash_name", requestId: merged });
  if (legacy) cases.push({ name: "legacy_plus_co_owner", requestId: legacy });
  if (ucOnly) cases.push({ name: "unit_clients_only", requestId: ucOnly });
  return cases;
}

async function main() {
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });

  const cases = loadMatrixFromEnv();
  if (cases.length === 0) {
    throw new Error(
      "Set HANDOVER_MERGED_REQUEST_ID, HANDOVER_LEGACY_CO_REQUEST_ID, HANDOVER_UC_ONLY_REQUEST_ID (run seed-screenshot-data.ts)"
    );
  }

  const roles = [
    { key: "management", email: "demo-mgmt@test.local" },
    { key: "cs_agent", email: "demo-cs@test.local" },
  ];

  const results: EditResult[] = [];
  const browser = await chromium.launch({ headless: true });

  for (const role of roles) {
    for (const locale of ["en", "ar"] as const) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, locale, role.email, "TestPassword1234!");

      for (const item of cases) {
        const marker = `E2E_EDIT_${item.name}_${locale}_${role.key}_${Date.now()}`;
        const outcome = await editDescriptionOnRequestPage(
          page,
          locale,
          item.requestId,
          marker
        );
        results.push({
          name: item.name,
          locale,
          role: role.key,
          ok: outcome.ok,
          error: outcome.error,
        });

        if (!outcome.ok) {
          await page.screenshot({
            path: path.join(
              ARTIFACT_ROOT,
              `handover-edit-fail-${item.name}-${locale}-${role.key}.png`
            ),
            fullPage: true,
          });
        }
      }

      if (locale === "en" && role.key === "management" && cases[0]) {
        await page.goto(`${BASE_URL}/en/requests/${cases[0].requestId}`);
        await page.waitForTimeout(1500);
        await page.screenshot({
          path: path.join(ARTIFACT_ROOT, "handover-request-two-owner-edit-en.png"),
          fullPage: true,
        });
      }

      await context.close();
    }
  }

  await browser.close();

  const reportPath = path.join(ARTIFACT_ROOT, "handover-request-edit-matrix.json");
  fs.writeFileSync(reportPath, JSON.stringify({ results }, null, 2));

  const failures = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ total: results.length, failures: failures.length, results }, null, 2));

  if (failures.length > 0) {
    console.error("Handover request edit matrix had failures:", failures);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});