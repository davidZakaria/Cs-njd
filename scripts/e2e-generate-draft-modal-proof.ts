/**
 * PR #44 proof: modal "Generate draft PDF" — missing-token toast + complete generate/download (en + ar).
 * Fake demo data only (handover-e2e seed).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { chromium } from "playwright";
import { authenticator } from "otplib";

import { formatOfficialHandoverMissingToken } from "@/lib/official-documents/handover/constants";

authenticator.options = { window: 5 };

const STORE =
  process.env.HANDOVER_E2E_STORE?.trim() ||
  "/cursor/stores/self/handover-e2e-ui-evidence";
const BASE = process.env.AUTH_URL?.trim() || "http://localhost:3000";
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.join(STORE, "generate-modal-proof", RUN_ID);

async function syncHandoverTextarea(
  textarea: import("playwright").Locator,
  value: string
) {
  await textarea.fill(value);
  await textarea.dispatchEvent("input");
  await textarea.dispatchEvent("change");
  let got = await textarea.inputValue();
  if (got !== value) {
    await textarea.evaluate((el, v) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      setter?.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    got = await textarea.inputValue();
  }
  if (got !== value) {
    throw new Error("Handover textarea React sync failed");
  }
}

type LocaleResult = {
  locale: "en" | "ar";
  incomplete: { screenshot: string; toasts: string[]; footerHint: string };
  complete: {
    screenshot: string;
    editMarker: string;
    pdfPath: string;
    documentId?: string;
    pdftotextSnippet: string;
    toasts: string[];
  };
};

async function login(
  page: import("playwright").Page,
  locale: "en" | "ar",
  email: string,
  password: string
) {
  const secret = fs.readFileSync(path.join(STORE, "two-factor-secret.txt"), "utf8").trim();
  await page.goto(`${BASE}/${locale}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  const submit = page.locator('form button[type="submit"]');
  await Promise.all([
    page.waitForURL(/\/(en|ar)\/(verify-2fa|dashboard|units|executive)/, {
      timeout: 90_000,
      waitUntil: "domcontentloaded",
    }),
    submit.click(),
  ]);
  if (page.url().includes("verify-2fa")) {
    await page.locator("#token").fill(authenticator.generate(secret));
    await Promise.all([
      page.waitForURL(/\/(en|ar)\/(dashboard|units|executive)/, { timeout: 90_000 }),
      page.locator("form").getByRole("button", { name: /continue|متابعة/i }).click(),
    ]);
  }
}

async function openHandoverEditor(page: import("playwright").Page, locale: "en" | "ar", unitId: string) {
  await page.goto(`${BASE}/${locale}/units/${unitId}`, { waitUntil: "domcontentloaded" });
  const docType = page
    .getByText(locale === "ar" ? /نوع المستند/ : /Document type/)
    .locator("..")
    .getByRole("combobox")
    .first();
  if (await docType.isVisible().catch(() => false)) {
    await docType.click();
    await page.getByRole("option", { name: locale === "ar" ? /محضر/ : /Handover record/i }).click();
  }
  const editNeedle = locale === "ar" ? "تعديل النص" : "Edit text";
  await page.waitForFunction(
    (needle) => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").includes(needle)
      ) as HTMLButtonElement | undefined;
      return Boolean(btn && !btn.disabled);
    },
    editNeedle,
    { timeout: 120_000 }
  );
  await page.getByRole("button", { name: locale === "ar" ? /تعديل النص/i : /^Edit text$/i }).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  const dialog = page.getByRole("dialog");
  const textarea = dialog.locator('[data-slot="textarea"]').first();
  await textarea.waitFor({ state: "visible", timeout: 120_000 });
  const loadProposedBtn = dialog.getByRole("button", {
    name: locale === "ar" ? /تحميل النص الرسمي/i : /Load proposed official/i,
  });
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const body = await textarea.inputValue();
    if (/أولاً|اولا|إقرار/u.test(body) && body.length > 500) return;
    if (attempt === 5 && (await loadProposedBtn.isVisible().catch(() => false))) {
      await loadProposedBtn.click();
    }
    if (attempt === 20 && (await loadProposedBtn.isVisible().catch(() => false))) {
      await loadProposedBtn.click();
    }
    await page.waitForTimeout(2000);
  }
  const sample = (await textarea.inputValue()).slice(0, 200);
  throw new Error(`Handover body never loaded in editor. sample=${JSON.stringify(sample)}`);
}

async function runLocale(
  locale: "en" | "ar",
  unitId: string,
  email: string,
  password: string
): Promise<LocaleResult> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({ acceptDownloads: true, locale: locale === "ar" ? "ar-EG" : "en-US" });
  const page = await context.newPage();
  const localeDir = path.join(OUT, locale);
  fs.mkdirSync(localeDir, { recursive: true });

  await login(page, locale, email, password);
  await openHandoverEditor(page, locale, unitId);

  const dialog = page.getByRole("dialog");
  const textarea = dialog.locator('[data-slot="textarea"]').first();
  const modalGenerate = dialog.getByTestId("generate-draft-pdf");
  const missingToken = formatOfficialHandoverMissingToken("owner1_email");

  // --- Incomplete body: inject placeholder, attempt generate ---
  const baseBody = await textarea.inputValue();
  const emailPattern = /demo-owner[^\s@]+@example\.test/g;
  const incompleteBody = emailPattern.test(baseBody)
    ? baseBody.replace(emailPattern, missingToken)
    : `${baseBody.trimEnd()}\n\n${missingToken}`;
  await syncHandoverTextarea(textarea, incompleteBody);
  // Handover editor uses template locale (Arabic) for missing-field labels/toasts even on /en UI.
  const missingNeedle = "بريد المالك الأساسي";
  await page.waitForFunction(
    (needle) => {
      const d = document.querySelector('[role="dialog"]');
      return Boolean(d?.textContent?.includes(needle));
    },
    missingNeedle,
    { timeout: 30_000 }
  );
  const missingLabel = /بريد المالك الأساسي|Primary owner email/u;
  await dialog.locator("li").filter({ hasText: missingLabel }).first().waitFor({ timeout: 5_000 });
  await dialog
    .locator('[role="status"]')
    .filter({
      hasText: /لا يمكن إنشاء PDF|Cannot generate PDF|بريد المالك الأساسي|Primary owner email/u,
    })
    .first()
    .waitFor({ timeout: 30_000 });
  await modalGenerate.click();
  await page
    .locator("[data-sonner-toast]")
    .filter({
      hasText: /لا يمكن إنشاء PDF|Cannot generate PDF|بريد المالك الأساسي|Primary owner email/u,
    })
    .first()
    .waitFor({ timeout: 30_000 });
  const incompleteToasts = await page.locator("[data-sonner-toast]").allTextContents();
  const footerHint =
    (await dialog.locator('[role="status"]').first().textContent().catch(() => "")) ?? "";
  const incompleteShot = path.join(localeDir, "incomplete-missing-token.png");
  await page.screenshot({ path: incompleteShot, fullPage: true });

  // --- Complete body: remove placeholder, append edit marker, save, generate, download ---
  const editMarker = `MODAL_PROOF_${locale}_${RUN_ID.slice(0, 12)}`;
  await syncHandoverTextarea(textarea, `${baseBody.trimEnd()}\n\n${editMarker}`);

  const modalSave = dialog.getByRole("button", {
    name: locale === "ar" ? /حفظ نسخة النص/ : /Save text version/i,
  });
  await modalSave.click();
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: locale === "ar" ? /تم حفظ نص المسودة/ : /Draft text saved/ })
    .first()
    .waitFor({ timeout: 120_000 });

  const knownIds = new Set<string>();
  await page.reload({ waitUntil: "domcontentloaded" });
  const rows = await page.locator("[data-official-generated-document-id]").all();
  for (const row of rows) {
    const id = await row.getAttribute("data-official-generated-document-id");
    if (id) knownIds.add(id);
  }

  await openHandoverEditor(page, locale, unitId);
  const textarea2 = page.getByRole("dialog").locator('[data-slot="textarea"]').first();
  const bodyNow = await textarea2.inputValue();
  if (!bodyNow.includes(editMarker)) {
    await syncHandoverTextarea(textarea2, `${bodyNow.trimEnd()}\n\n${editMarker}`);
  }

  const genBtn = page.getByRole("dialog").getByTestId("generate-draft-pdf");
  await genBtn.click();
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: locale === "ar" ? /تم إنشاء مسودة PDF/ : /Draft PDF generated/ })
    .first()
    .waitFor({ timeout: 180_000 });
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 60_000 }).catch(() => {});

  const completeToasts = await page.locator("[data-sonner-toast]").allTextContents();
  const completeShot = path.join(localeDir, "complete-generate-success.png");
  await page.screenshot({ path: completeShot, fullPage: true });

  const pdfPath = path.join(localeDir, `generated-${locale}.pdf`);
  let documentId: string | undefined;
  await page.waitForFunction(
    (prevCount) =>
      document.querySelectorAll("[data-official-generated-document-id]").length > prevCount,
    knownIds.size,
    { timeout: 120_000 }
  );
  const allDocLinks = await page.locator("[data-official-generated-document-id]").all();
  for (const link of allDocLinks) {
    const id = await link.getAttribute("data-official-generated-document-id");
    if (id && !knownIds.has(id)) {
      documentId = id;
      const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
      await link.click();
      const download = await downloadPromise;
      await download.saveAs(pdfPath);
      const getRes = await page.request.get(`${BASE}/api/units/${unitId}/generated-documents/${id}`);
      if (!getRes.ok()) throw new Error(`GET stored PDF failed: ${getRes.status()}`);
      fs.writeFileSync(pdfPath, await getRes.body());
      break;
    }
  }
  if (!documentId) throw new Error(`${locale}: no new generated document row after modal generate`);

  const pdftotext = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  if (!pdftotext.includes(editMarker) && !pdftotext.replace(/\s+/g, " ").includes(editMarker.replace(/\s+/g, " "))) {
    throw new Error(`${locale}: PDF missing edit marker ${editMarker}`);
  }
  if (!/مخالف|إقرار|محضر/u.test(pdftotext)) {
    throw new Error(`${locale}: PDF does not look like Arabic official handover`);
  }

  await browser.close();

  return {
    locale,
    incomplete: { screenshot: incompleteShot, toasts: incompleteToasts, footerHint },
    complete: {
      screenshot: completeShot,
      editMarker,
      pdfPath,
      documentId,
      pdftotextSnippet: pdftotext.slice(-400),
      toasts: completeToasts,
    },
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(STORE, "manifest.json"), "utf8")) as {
    loginEmail: string;
    units: Array<{ variant: string; unitId: string }>;
  };
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) throw new Error("SUPER_ADMIN_PASSWORD required");
  const unit = manifest.units.find((u) => u.variant === "green-avenue");
  if (!unit) throw new Error("green-avenue unit missing from manifest");

  const en = await runLocale("en", unit.unitId, manifest.loginEmail, password);
  const ar = await runLocale("ar", unit.unitId, manifest.loginEmail, password);

  const report = {
    runId: RUN_ID,
    evidenceRoot: OUT,
    baseUrl: BASE,
    unitId: unit.unitId,
    pr: "PR44-modal-generate-draft-pdf",
    en,
    ar,
    passed: true,
  };
  fs.writeFileSync(path.join(OUT, "proof-report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(STORE, "generate-modal-proof", "LATEST.txt"),
    `${RUN_ID}\n${OUT}\n`
  );
  console.log("PROOF PASS", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
