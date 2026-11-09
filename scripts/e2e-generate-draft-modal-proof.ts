/**
 * PR #44 proof: modal "Generate draft PDF" — missing-token toast + complete generate/download (en + ar).
 * Fake demo data only (handover-e2e seed).
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { authenticator } from "otplib";

import { formatOfficialHandoverMissingToken } from "@/lib/official-documents/handover/constants";
import {
  assertHandoverPdfSliceNoFusion,
  assertHandoverViolationWordBoundaries,
  handoverTextHasFusedAdmAmal,
  SPACED_ADM_AMAL_PATTERN,
} from "@/lib/official-documents/handover/violation-word-boundary";
import { resolveOfficialDocumentGenerationContext } from "@/lib/official-documents/draft-context";

const prisma = new PrismaClient();

function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sha256Utf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function pdfPageText(pdfPath: string, page: number): string {
  return execFileSync("pdftotext", ["-f", String(page), "-l", String(page), pdfPath, "-"], {
    encoding: "utf8",
  });
}

function pdfToPngPage(pdfPath: string, page: number, outPath: string): void {
  const dir = path.dirname(outPath);
  const base = path.basename(outPath, ".png");
  execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-png", "-singlefile", pdfPath, path.join(dir, base)]);
}

async function auditPersistedHandoverDraft(unitId: string) {
  const draft = await prisma.officialDocumentTextDraft.findFirst({
    where: { unitId, documentType: "HANDOVER_RECORD" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, currentBody: true, updatedAt: true, templateLocale: true },
  });
  const body = draft?.currentBody ?? "";
  const stripped = stripAccumulatedModalProofMarkers(body);
  return {
    unitId,
    draftId: draft?.id ?? null,
    updatedAt: draft?.updatedAt?.toISOString() ?? null,
    templateLocale: draft?.templateLocale ?? null,
    bodyChars: stripped.length,
    sha256: stripped.length ? sha256Utf8(stripped) : null,
    hasFusedAdmAmal: handoverTextHasFusedAdmAmal(stripped),
    sampleFused: stripped.match(/[^\n]{0,20}عدمعمل[^\n]{0,30}/u)?.[0] ?? null,
  };
}

/** Prior modal proof runs append markers; strip before save/generate pagination checks. */
function stripAccumulatedModalProofMarkers(body: string): string {
  return body
    .replace(/\nMODAL_PROOF_(en|ar)_[^\n]+/g, "")
    .replace(/\nLEGAL_E2E_FOOTER_MARKER[^\n]*/g, "")
    .trimEnd();
}

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
  sourceProvenance: {
    persistedBeforeLoadSha256: string;
    persistedBeforeLoadHadFusion: boolean;
    freshProposedSha256: string;
    freshProposedSnapshotPath: string;
    freshSourceMethod: string;
    generationContextInitialBodySha256: string;
    baselineSavedViaModal: boolean;
  };
  incomplete: {
    screenshotFull: string;
    screenshotFooterViewport: string;
    toasts: string[];
    footerHint: string;
  };
  complete: {
    screenshot: string;
    editMarker: string;
    documentId?: string;
    pdfBrowserDownloadPath: string;
    pdfStoredGetPath: string;
    pdfSha256BrowserDownload: string;
    pdfSha256StoredGet: string;
    pdfSha256Match: boolean;
    pdftotextSnippet: string;
    pdfPage2TextPath: string;
    pdfPage2ScreenshotPath: string;
    pdfHadFusedAdmAmal: boolean;
    persistedEditMarkerAfterSave: boolean;
    toasts: string[];
  };
};

type GuardProofResult = {
  signedCopyLock: {
    documentId: string;
    textDraftId: string;
    toast: string;
    screenshot: string;
    restored: boolean;
  };
  linkedRequestRejection: {
    requestId: string;
    draftId: string;
    toast: string;
    screenshot: string;
    cleanedUp: boolean;
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

async function waitForCorrectHandoverEditorBody(
  page: import("playwright").Page,
  textarea: import("playwright").Locator,
  locale: "en" | "ar",
  label: string
): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const body = stripAccumulatedModalProofMarkers(await textarea.inputValue());
    if (/أولاً|اولا|إقرار/u.test(body) && body.length > 500) {
      assertHandoverViolationWordBoundaries(body, `${locale} ${label}`);
      return body;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`${locale}: handover editor never reached corrected Arabic body (${label})`);
}

async function ensureFreshCorrectedHandoverSource(input: {
  page: import("playwright").Page;
  locale: "en" | "ar";
  unitId: string;
}): Promise<{ body: string; method: string; generationContextInitialBodySha256: string }> {
  const dialog = input.page.getByRole("dialog");
  const textarea = dialog.locator('[data-slot="textarea"]').first();
  const loadProposedBtn = dialog.getByRole("button", {
    name: input.locale === "ar" ? /تحميل النص الرسمي/i : /Load proposed official/i,
  });

  const ctx = await resolveOfficialDocumentGenerationContext({
    unitId: input.unitId,
    documentType: "HANDOVER_RECORD",
    locale: "en",
  });
  if (!ctx.ok) throw new Error(`generation context: ${ctx.error}`);
  assertHandoverViolationWordBoundaries(
    ctx.initialBody,
    `${input.locale} resolveOfficialDocumentGenerationContext.initialBody`
  );
  const generationContextInitialBodySha256 = sha256Utf8(ctx.initialBody);

  if (await loadProposedBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await loadProposedBtn.click();
    const body = await waitForCorrectHandoverEditorBody(
      input.page,
      textarea,
      input.locale,
      "Load proposed official UI"
    );
    return {
      body,
      method: "load_proposed_official_ui",
      generationContextInitialBodySha256,
    };
  }

  const editorNow = stripAccumulatedModalProofMarkers(await textarea.inputValue());
  const editorLooksCorrect =
    editorNow.length > 500 &&
    !handoverTextHasFusedAdmAmal(editorNow) &&
    (() => {
      try {
        assertHandoverViolationWordBoundaries(editorNow, "editor pre-check");
        return true;
      } catch {
        return false;
      }
    })();
  if (editorLooksCorrect && sha256Utf8(editorNow) === generationContextInitialBodySha256) {
    return {
      body: editorNow,
      method: "editor_already_matches_generation_context",
      generationContextInitialBodySha256,
    };
  }

  await syncHandoverTextarea(textarea, ctx.initialBody);
  const body = await waitForCorrectHandoverEditorBody(
    input.page,
    textarea,
    input.locale,
    "editor sync from generation context"
  );
  return {
    body,
    method: "editor_sync_generation_context_initialBody",
    generationContextInitialBodySha256,
  };
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
  const modalSave = dialog.getByRole("button", {
    name: locale === "ar" ? /حفظ نسخة النص/ : /Save text version/i,
  });
  const missingToken = formatOfficialHandoverMissingToken("owner1_email");

  const persistedBeforeLoad = stripAccumulatedModalProofMarkers(await textarea.inputValue());
  const persistedBeforeLoadSha256 = sha256Utf8(persistedBeforeLoad);
  const persistedBeforeLoadHadFusion = handoverTextHasFusedAdmAmal(persistedBeforeLoad);

  const fresh = await ensureFreshCorrectedHandoverSource({ page, locale, unitId });
  const sourceBody = fresh.body;
  const freshProposedSha256 = sha256Utf8(sourceBody);
  const freshProposedSnapshotPath = path.join(localeDir, "source-proposed-before-save.txt");
  fs.writeFileSync(freshProposedSnapshotPath, sourceBody, "utf8");
  fs.writeFileSync(
    path.join(localeDir, "source-provenance.json"),
    JSON.stringify(
      {
        persistedBeforeLoadSha256,
        persistedBeforeLoadHadFusion,
        freshProposedSha256,
        freshSourceMethod: fresh.method,
        generationContextInitialBodySha256: fresh.generationContextInitialBodySha256,
        editorMatchesGenerationContext: freshProposedSha256 === fresh.generationContextInitialBodySha256,
      },
      null,
      2
    ),
    "utf8"
  );

  // Establish clean persisted draft from corrected master (explicit load + save — not a DB rewrite).
  await syncHandoverTextarea(textarea, sourceBody);
  await modalSave.click();
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: locale === "ar" ? /تم حفظ نص المسودة/ : /Draft text saved/ })
    .first()
    .waitFor({ timeout: 120_000 });

  // --- Incomplete body: inject placeholder, attempt generate ---
  const baseBody = sourceBody;
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
  await modalGenerate.scrollIntoViewIfNeeded();
  await dialog.locator('[role="status"]').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const incompleteFooterShot = path.join(localeDir, "incomplete-missing-token-footer-viewport.png");
  await page.screenshot({ path: incompleteFooterShot, fullPage: false });
  const incompleteShot = path.join(localeDir, "incomplete-missing-token.png");
  await page.screenshot({ path: incompleteShot, fullPage: true });

  // --- Complete body: remove placeholder, append edit marker, save, generate, download ---
  const editMarker = `MODAL_PROOF_${locale}_${RUN_ID.slice(0, 12)}`;
  await syncHandoverTextarea(textarea, `${baseBody.trimEnd()}\n\n${editMarker}`);

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

  const pdfBrowserPath = path.join(localeDir, `browser-download-${locale}.pdf`);
  const pdfStoredPath = path.join(localeDir, `stored-get-${locale}.pdf`);
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
      await download.saveAs(pdfBrowserPath);
      const getRes = await page.request.get(`${BASE}/api/units/${unitId}/generated-documents/${id}`);
      if (!getRes.ok()) throw new Error(`GET stored PDF failed: ${getRes.status()}`);
      fs.writeFileSync(pdfStoredPath, Buffer.from(await getRes.body()));
      break;
    }
  }
  if (!documentId) throw new Error(`${locale}: no new generated document row after modal generate`);

  const shaBrowser = sha256File(pdfBrowserPath);
  const shaStored = sha256File(pdfStoredPath);
  if (shaBrowser !== shaStored) {
    throw new Error(
      `${locale}: browser download SHA256 ${shaBrowser} != stored GET ${shaStored}`
    );
  }

  const pdftotext = execFileSync("pdftotext", [pdfStoredPath, "-"], { encoding: "utf8" });
  const page2Text = pdfPageText(pdfStoredPath, 2);
  const pdfPage2TextPath = path.join(localeDir, "stored-get-page2.txt");
  fs.writeFileSync(pdfPage2TextPath, page2Text, "utf8");
  const pdfPage2ScreenshotPath = path.join(localeDir, "stored-get-page2.png");
  pdfToPngPage(pdfStoredPath, 2, pdfPage2ScreenshotPath);

  assertHandoverViolationWordBoundaries(pdftotext, `${locale} PDF full text`);
  assertHandoverPdfSliceNoFusion(page2Text, `${locale} PDF page 2`);
  if (!SPACED_ADM_AMAL_PATTERN.test(pdftotext)) {
    throw new Error(`${locale} PDF full text missing spaced عدم عمل`);
  }
  if (!pdftotext.includes(editMarker) && !pdftotext.replace(/\s+/g, " ").includes(editMarker.replace(/\s+/g, " "))) {
    throw new Error(`${locale}: PDF missing edit marker ${editMarker}`);
  }
  if (!/مخالف|إقرار|محضر/u.test(pdftotext)) {
    throw new Error(`${locale}: PDF does not look like Arabic official handover`);
  }

  const draftAfter = await prisma.officialDocumentTextDraft.findFirst({
    where: { unitId, documentType: "HANDOVER_RECORD" },
    orderBy: { updatedAt: "desc" },
    select: { currentBody: true },
  });
  const persistedEditMarkerAfterSave = Boolean(draftAfter?.currentBody?.includes(editMarker));

  await browser.close();

  return {
    locale,
    sourceProvenance: {
      persistedBeforeLoadSha256,
      persistedBeforeLoadHadFusion,
      freshProposedSha256,
      freshProposedSnapshotPath,
      freshSourceMethod: fresh.method,
      generationContextInitialBodySha256: fresh.generationContextInitialBodySha256,
      baselineSavedViaModal: true,
    },
    incomplete: {
      screenshotFull: incompleteShot,
      screenshotFooterViewport: incompleteFooterShot,
      toasts: incompleteToasts,
      footerHint,
    },
    complete: {
      screenshot: completeShot,
      editMarker,
      documentId,
      pdfBrowserDownloadPath: pdfBrowserPath,
      pdfStoredGetPath: pdfStoredPath,
      pdfSha256BrowserDownload: shaBrowser,
      pdfSha256StoredGet: shaStored,
      pdfSha256Match: true,
      pdftotextSnippet: pdftotext.slice(-400),
      pdfPage2TextPath,
      pdfPage2ScreenshotPath,
      pdfHadFusedAdmAmal: false,
      persistedEditMarkerAfterSave,
      toasts: completeToasts,
    },
  };
}

async function runDynamicGuardProofs(input: {
  handoverUnitId: string;
  graceUnitId: string;
  email: string;
  password: string;
  signedOnDocumentId: string;
}): Promise<GuardProofResult> {
  const guardDir = path.join(OUT, "guards");
  fs.mkdirSync(guardDir, { recursive: true });

  const generated = await prisma.unitGeneratedDocument.findUnique({
    where: { id: input.signedOnDocumentId },
    select: { id: true, textDraftId: true, unitId: true },
  });
  if (!generated?.textDraftId) {
    throw new Error("Signed-lock proof: generated document missing textDraftId");
  }

  const signedAt = new Date();
  await prisma.unitGeneratedDocument.update({
    where: { id: generated.id },
    data: { signedCopyOnFileAt: signedAt },
  });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await login(page, "en", input.email, input.password);
  await openHandoverEditor(page, "en", input.handoverUnitId);
  const signedShot = path.join(guardDir, "signed-copy-lock-generate-blocked.png");
  await page.getByRole("dialog").getByTestId("generate-draft-pdf").click();
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: /signed copy on file/i })
    .first()
    .waitFor({ timeout: 60_000 });
  const signedToast =
    (await page.locator("[data-sonner-toast]").first().textContent())?.trim() ?? "";
  await page.screenshot({ path: signedShot, fullPage: false });

  await prisma.unitGeneratedDocument.update({
    where: { id: generated.id },
    data: { signedCopyOnFileAt: null },
  });

  const admin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("Super admin required for guard proof");

  const graceTemplate = await prisma.officialDocumentTemplate.findFirst({
    where: { documentType: "GRACE_PERIOD_ANNEX", locale: "en", isActive: true },
  });
  if (!graceTemplate) throw new Error("Grace period annex template missing");

  const cancelledRequest = await prisma.unitRequest.create({
    data: {
      type: "GRACE_PERIOD_ANNEX",
      unitId: input.graceUnitId,
      requestedById: admin.id,
      status: "APPROVED",
      submittedAt: new Date(),
      description: "E2E guard proof — will cancel before generate",
    },
  });

  const graceBody =
    "Grace Period Annex\n\nUnit: {{unitNumber}}\n\nGuard proof body for linked-request rejection.";
  const graceDraft = await prisma.officialDocumentTextDraft.create({
    data: {
      unitId: input.graceUnitId,
      documentType: "GRACE_PERIOD_ANNEX",
      templateId: graceTemplate.id,
      templateVersion: graceTemplate.version,
      templateLocale: "en",
      title: graceTemplate.title,
      currentBody: graceBody,
      unitRequestId: cancelledRequest.id,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });
  await prisma.officialDocumentTextDraftVersion.create({
    data: {
      draftId: graceDraft.id,
      body: graceBody,
      editedById: admin.id,
    },
  });

  await page.goto(`${BASE}/en/units/${input.graceUnitId}`, { waitUntil: "domcontentloaded" });
  const docType = page
    .getByText(/Document type/)
    .locator("..")
    .getByRole("combobox")
    .first();
  await docType.click();
  await page.getByRole("option", { name: /Grace period annex/i }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /^Edit text$/i }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 60_000 });

  await prisma.unitRequest.update({
    where: { id: cancelledRequest.id },
    data: { status: "CANCELLED", resolvedAt: new Date() },
  });

  const graceDialog = page.getByRole("dialog");
  await graceDialog.getByRole("button", { name: /Save text version/i }).click();
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: /no longer approved/i })
    .first()
    .waitFor({ timeout: 60_000 });
  const linkedToast =
    (await page.locator("[data-sonner-toast]").first().textContent())?.trim() ?? "";
  const linkedShot = path.join(guardDir, "linked-request-cancelled-save-blocked.png");
  await page.screenshot({ path: linkedShot, fullPage: false });

  await prisma.officialDocumentTextDraftVersion.deleteMany({
    where: { draftId: graceDraft.id },
  });
  await prisma.officialDocumentTextDraft.delete({ where: { id: graceDraft.id } });
  await prisma.unitRequest.delete({ where: { id: cancelledRequest.id } });

  await browser.close();

  return {
    signedCopyLock: {
      documentId: generated.id,
      textDraftId: generated.textDraftId,
      toast: signedToast,
      screenshot: signedShot,
      restored: true,
    },
    linkedRequestRejection: {
      requestId: cancelledRequest.id,
      draftId: graceDraft.id,
      toast: linkedToast,
      screenshot: linkedShot,
      cleanedUp: true,
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
  const graceUnit = manifest.units.find((u) => u.variant === "green-avenue-no-insurance");
  if (!unit) throw new Error("green-avenue unit missing from manifest");
  if (!graceUnit) throw new Error("green-avenue-no-insurance unit missing from manifest");

  const persistedDraftAuditBefore = await auditPersistedHandoverDraft(unit.unitId);
  fs.writeFileSync(
    path.join(OUT, "persisted-draft-audit-before-proof.json"),
    JSON.stringify(persistedDraftAuditBefore, null, 2)
  );

  const en = await runLocale("en", unit.unitId, manifest.loginEmail, password);
  const ar = await runLocale("ar", unit.unitId, manifest.loginEmail, password);

  const persistedDraftAuditAfter = await auditPersistedHandoverDraft(unit.unitId);
  fs.writeFileSync(
    path.join(OUT, "persisted-draft-audit-after-proof.json"),
    JSON.stringify(persistedDraftAuditAfter, null, 2)
  );
  if (!en.complete.documentId) throw new Error("en complete missing documentId");

  const guards = await runDynamicGuardProofs({
    handoverUnitId: unit.unitId,
    graceUnitId: graceUnit.unitId,
    email: manifest.loginEmail,
    password,
    signedOnDocumentId: en.complete.documentId,
  });

  const report = {
    runId: RUN_ID,
    evidenceRoot: OUT,
    baseUrl: BASE,
    unitId: unit.unitId,
    graceGuardUnitId: graceUnit.unitId,
    pr: "PR45-modal-clean-source-proof",
    persistedDraftAuditBefore,
    persistedDraftAuditAfter,
    en,
    ar,
    dynamicGuards: guards,
    passed: true,
  };
  fs.writeFileSync(path.join(OUT, "proof-report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(STORE, "generate-modal-proof", "LATEST.txt"),
    `${RUN_ID}\n${OUT}\n`
  );
  console.log("PROOF PASS", OUT);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  void prisma.$disconnect();
  process.exit(1);
});
