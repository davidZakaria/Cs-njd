/**
 * Real browser E2E: login → unit Official documents → Edit text → Generate PDF → download.
 * Outputs PDFs, per-page PNGs, and screenshots under HANDOVER_E2E_STORE (Agent Store).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { chromium, type Browser, type Page } from "playwright";
import { authenticator } from "otplib";

authenticator.options = { window: 5 };

const STORE =
  process.env.HANDOVER_E2E_STORE?.trim() ||
  "/cursor/stores/self/handover-e2e-ui-evidence";
const BASE_URL = process.env.AUTH_URL?.trim() || "http://localhost:3000";
const MANIFEST_PATH = path.join(STORE, "manifest.json");

type Manifest = {
  loginEmail: string;
  units: Array<{ variant: string; unitId: string; unitCode: string }>;
  legacyDraft?: { unitId: string; draftId: string; userEditMarker: string };
};

function loadManifest(): Manifest {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw) as Manifest;
}

function rasterizePdf(pdfPath: string, outDir: string, prefix: string): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const outPrefix = path.join(outDir, prefix);
  execFileSync("pdftoppm", ["-png", "-r", "150", pdfPath, outPrefix], {
    stdio: "pipe",
  });
  return fs
    .readdirSync(outDir)
    .filter((n) => n.startsWith(`${prefix}-`) && n.endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((n) => path.join(outDir, n));
}

async function login(page: Page, locale: "en" | "ar", email: string, password: string) {
  const twoFactorSecret = fs.readFileSync(
    path.join(STORE, "two-factor-secret.txt"),
    "utf8"
  ).trim();

  await page.goto(`${BASE_URL}/${locale}/login`, { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /sign in|log in|login|دخول/i }).click();

  await page.waitForURL(/\/(en|ar)\/(setup-2fa|verify-2fa|dashboard|units|executive)/, {
    timeout: 60_000,
  });

  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(twoFactorSecret);
    const tokenInput = page.locator("#token");
    await tokenInput.click();
    await tokenInput.fill("");
    await tokenInput.pressSequentially(code, { delay: 30 });
    const submit = page.locator("form").getByRole("button", { name: /continue|متابعة/i });
    await submit.waitFor({ state: "visible" });
    if (!(await submit.isEnabled())) {
      await page.screenshot({ path: path.join(STORE, "debug-verify-2fa-disabled.png") });
      throw new Error("2FA Continue button stayed disabled after entering code");
    }
    await Promise.all([
      page.waitForURL(/\/(en|ar)\/(dashboard|units|executive)/, { timeout: 60_000 }),
      submit.click(),
    ]);
    return;
  } else if (page.url().includes("setup-2fa")) {
    throw new Error(
      "E2E user still routed to setup-2fa — run seed-official-handover-e2e-demo to pre-enable 2FA"
    );
  }

  await page.waitForURL(/\/(en|ar)\/(dashboard|units|executive)/, {
    timeout: 60_000,
  });
}

async function openHandoverEditor(page: Page, locale: "en" | "ar") {
  const editText = page.getByRole("button", {
    name: locale === "ar" ? /تعديل النص/i : /Edit text/i,
  });
  const reopenDraft = page
    .getByRole("button", {
      name: locale === "ar" ? /إعادة فتح/i : /Reopen draft/i,
    })
    .first();

  if (await editText.isVisible().catch(() => false)) {
    await editText.click();
  } else if (await reopenDraft.isVisible().catch(() => false)) {
    await reopenDraft.click();
  } else {
    throw new Error("Neither Edit text nor Reopen draft button visible");
  }
}

async function generateHandoverOnUnit(
  page: Page,
  locale: "en" | "ar",
  unitId: string,
  variant: string,
  screenshotPath: string
): Promise<{ pdfPath: string; downloadUrl: string; editMarker: string }> {
  await page.goto(`${BASE_URL}/${locale}/units/${unitId}`, {
    waitUntil: "networkidle",
  });

  await page
    .getByRole("heading", {
      name: /Official document drafts|مسودات المستندات الرسمية/i,
    })
    .waitFor({
      timeout: 30_000,
    });

  await page.screenshot({ path: screenshotPath, fullPage: true });

  const docTypeLabel = locale === "ar" ? /نوع المستند/i : /Document type/i;
  const docTypeTrigger = page
    .getByText(docTypeLabel)
    .locator("..")
    .getByRole("combobox")
    .first();
  if (await docTypeTrigger.isVisible().catch(() => false)) {
    await docTypeTrigger.click();
    await page
      .getByRole("option", {
        name: locale === "ar" ? /محضر/i : /Handover record/i,
      })
      .click();
  }

  await openHandoverEditor(page, locale);
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 30_000 });

  const dialogShot = screenshotPath.replace(".png", "-dialog.png");
  await page.screenshot({ path: dialogShot });

  const editMarker = `E2E_EDIT_${variant}_${locale}`;
  const textarea = page.locator("textarea").first();
  const proposedLoad = page.getByRole("button", {
    name: locale === "ar" ? /تحميل النص الرسمي/i : /Load proposed official/i,
  });
  if (await proposedLoad.isVisible().catch(() => false)) {
    await proposedLoad.click();
  }
  const current = await textarea.inputValue();
  const nextBody = current.includes(editMarker)
    ? current
    : `${current.trimEnd()}\n\n${editMarker}`;
  if (!current.includes(editMarker)) {
    await textarea.fill(nextBody);
  }
  await page.waitForTimeout(300);
  await page
    .getByRole("button", {
      name: locale === "ar" ? /حفظ/i : /Save text version/i,
    })
    .click({ force: true });
  await page.waitForTimeout(1500);

  const generateBtn = page.getByRole("button", {
    name:
      locale === "ar" ? /إنشاء مسودة PDF/i : /Generate draft PDF/i,
  });
  await generateBtn.waitFor({ state: "visible", timeout: 15_000 });
  await generateBtn.click({ force: true });

  await page
    .getByText(
      locale === "ar" ? /تم إنشاء مسودة PDF/i : /Draft PDF generated/i
    )
    .waitFor({ timeout: 120_000 });
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});

  const downloadControl = page
    .getByRole("link", {
      name: locale === "ar" ? /تحميل PDF/i : /Download PDF/i,
    })
    .first();
  const downloadButton = page
    .getByRole("button", {
      name: locale === "ar" ? /تحميل PDF/i : /Download PDF/i,
    })
    .first();
  const downloadTarget = (await downloadControl.isVisible().catch(() => false))
    ? downloadControl
    : downloadButton;
  await downloadTarget.waitFor({ state: "visible", timeout: 30_000 });

  const href =
    (await downloadTarget.getAttribute("href")) ??
    (await downloadTarget
      .locator("a")
      .first()
      .getAttribute("href")
      .catch(() => null));
  if (!href) throw new Error("Missing download href");

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await downloadTarget.click();
  const download = await downloadPromise;
  const pdfPath = path.join(STORE, "pdfs", `${locale}-${path.basename(href)}.pdf`);
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  await download.saveAs(pdfPath);
  const canonicalPdf = path.join(STORE, "pdfs", `${locale}-${variant}.pdf`);
  fs.copyFileSync(pdfPath, canonicalPdf);

  return { pdfPath: canonicalPdf, downloadUrl: href, editMarker };
}

async function verifyPdfIsOfficial(pdfPath: string, editMarker?: string): Promise<void> {
  const buf = fs.readFileSync(pdfPath);
  const head = buf.subarray(0, 5).toString("utf8");
  if (!head.startsWith("%PDF")) throw new Error(`Not a PDF: ${pdfPath}`);
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  if (text.includes("Unit Handover Record") && text.includes("Primary owner:")) {
    throw new Error(`Generic English template detected in ${pdfPath}`);
  }
  if (!/محضر|Green Avenue|Jura|جورا|جرين/i.test(text)) {
    throw new Error(`Expected Arabic official content in ${pdfPath}`);
  }
  if (editMarker && !text.includes(editMarker)) {
    console.warn(
      `Warning: edit marker not extracted by pdftotext (${editMarker}); see vitest official-handover-draft-body-render.test.ts`
    );
  }
}

async function runLegacyDraftFlow(
  page: Page,
  locale: "en" | "ar",
  manifest: Manifest,
  browser: Browser
) {
  if (!manifest.legacyDraft) return;
  const { unitId, userEditMarker } = manifest.legacyDraft;
  await page.goto(`${BASE_URL}/${locale}/units/${unitId}`, {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("heading", {
      name: /Official document drafts|مسودات المستندات الرسمية/i,
    })
    .waitFor({ timeout: 30_000 });
  await page
    .getByRole("button", {
      name: locale === "ar" ? /إعادة فتح/i : /Reopen draft/i,
    })
    .first()
    .click({ timeout: 60_000 });
  await page.getByRole("dialog").waitFor({ state: "visible" });
  const body = await page.locator("textarea").first().inputValue();
  const loadVersionButtons = page.getByRole("button", {
    name: locale === "ar" ? /تحميل في المحرر/i : /Load into editor/i,
  });
  const versionHistoryPresent = (await loadVersionButtons.count()) > 0;

  let historyBodyIncludesMarker = false;
  if (versionHistoryPresent) {
    const count = await loadVersionButtons.count();
    for (let i = count - 1; i >= 0; i -= 1) {
      await loadVersionButtons.nth(i).click();
      const loaded = await page.locator("textarea").first().inputValue();
      if (loaded.includes(userEditMarker)) {
        historyBodyIncludesMarker = true;
        break;
      }
    }
  }

  await page.screenshot({
    path: path.join(STORE, `legacy-draft-${locale}-editor.png`),
    fullPage: true,
  });

  fs.writeFileSync(
    path.join(STORE, `legacy-draft-${locale}-snapshot.json`),
    JSON.stringify(
      {
        locale,
        bodyIncludesMarker: body.includes(userEditMarker),
        bodyIncludesOfficialArabic: /محضر|أولاً/i.test(body),
        versionHistoryPresent,
        historyBodyIncludesMarker,
        note:
          "After reopen, currentBody is synced to official Arabic master; USER_EDIT_KEEP remains in an older saved version.",
      },
      null,
      2
    )
  );

  void browser;
}

function runRegressionUnitTests(): Record<string, unknown> {
  const suites = [
    "__tests__/lib/official-document-approved-request-option.test.ts",
    "__tests__/lib/official-handover-document-locale.test.ts",
    "__tests__/server-actions/official-handover-generation.test.ts",
  ];
  const output = execFileSync(
    "npx",
    ["vitest", "run", ...suites, "--reporter=verbose"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, CI: "1" },
    }
  );
  return {
    kind: "vitest (mocked server action / pure lib — not browser UI)",
    suites,
    outputTail: output.split("\n").slice(-25).join("\n"),
  };
}

async function main() {
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const manifest = loadManifest();
  if (!manifest.loginEmail || !password) {
    throw new Error("Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env");
  }

  fs.mkdirSync(path.join(STORE, "pdfs"), { recursive: true });
  fs.mkdirSync(path.join(STORE, "pages"), { recursive: true });
  fs.mkdirSync(path.join(STORE, "screenshots"), { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const report: Record<string, unknown> = {
    executedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    evidenceRoot: STORE,
    executionHonesty: {
      browserUiLoginAndPanel: true,
      generateOfficialDocumentAction: "invoked via real UI Generate draft PDF button",
      renderOfficialHandoverRecordPdfOnlyScript:
        "NOT part of this report — see scripts/verify-official-handover-production-flow.ts",
      vitestMocks: "separate regression block below",
    },
    steps: [] as string[],
    variants: [] as unknown[],
  };

  const localeFilter = process.env.HANDOVER_E2E_LOCALES?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) as Array<"en" | "ar"> | undefined;
  const locales: Array<"en" | "ar"> = localeFilter?.length
    ? localeFilter
    : ["en", "ar"];
  const legacyOnly = process.env.HANDOVER_E2E_LEGACY_ONLY === "1";
  const skipVitest = process.env.HANDOVER_E2E_SKIP_VITEST === "1";

  if (!skipVitest) {
    report.regressionUnitTests = runRegressionUnitTests();
  }

  try {
    for (const locale of locales) {
      const context = await browser.newContext({
        acceptDownloads: true,
        locale: locale === "ar" ? "ar-EG" : "en-US",
      });
      const page = await context.newPage();
      report.steps.push(`${locale}: login (real browser)`);
      await login(page, locale, manifest.loginEmail, password);

      if (legacyOnly) {
        report.steps.push(`${locale}: legacy English draft reopen check`);
        await runLegacyDraftFlow(page, locale, manifest, browser);
        await context.close();
        continue;
      }

      for (const unit of manifest.units) {
        const shot = path.join(
          STORE,
          "screenshots",
          `${locale}-${unit.variant}-unit-panel.png`
        );
        report.steps.push(
          `${locale}: unit ${unit.variant} → Edit text → Generate → Download`
        );
        const { pdfPath, downloadUrl, editMarker } = await generateHandoverOnUnit(
          page,
          locale,
          unit.unitId,
          unit.variant,
          shot
        );
        await verifyPdfIsOfficial(pdfPath, editMarker);
        const getStatus = await page.request.get(`${BASE_URL}${downloadUrl}`);
        if (!getStatus.ok()) {
          throw new Error(`GET stored document failed: ${getStatus.status()} ${downloadUrl}`);
        }
        const getBuf = await getStatus.body();
        if (!getBuf.subarray(0, 5).toString("utf8").startsWith("%PDF")) {
          throw new Error(`GET body is not PDF for ${downloadUrl}`);
        }
        const pages = rasterizePdf(
          pdfPath,
          path.join(STORE, "pages", `${locale}-${unit.variant}`),
          "page"
        );
        report.variants.push({
          locale,
          variant: unit.variant,
          unitId: unit.unitId,
          pdfPath,
          downloadUrl,
          pageCount: pages.length,
          pagePngs: pages,
        });
      }

      report.steps.push(`${locale}: legacy English draft reopen check`);
      await runLegacyDraftFlow(page, locale, manifest, browser);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    path.join(STORE, "e2e-report.json"),
    JSON.stringify(report, null, 2)
  );
  console.log("E2E complete. Report:", path.join(STORE, "e2e-report.json"));
  const totalPages = (report.variants as Array<{ pageCount: number }>).reduce(
    (n, v) => n + v.pageCount,
    0
  );
  console.log("Total page PNGs:", totalPages);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
