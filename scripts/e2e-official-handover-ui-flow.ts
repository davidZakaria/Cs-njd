/**
 * Real browser E2E: login → unit Official documents → Edit text → Generate PDF → download.
 * Outputs PDFs, per-page PNGs, and screenshots under HANDOVER_E2E_STORE (Agent Store).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import crypto from "node:crypto";

function initFreshArtifactRun(): string {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  ARTIFACT_ROOT = path.join(STORE_BASE, "runs", runId);
  for (const sub of ["pdfs", "pages", "screenshots"] as const) {
    fs.mkdirSync(path.join(ARTIFACT_ROOT, sub), { recursive: true });
  }
  fs.writeFileSync(
    path.join(STORE_BASE, "LATEST_RUN.txt"),
    `${runId}\n${ARTIFACT_ROOT}\n`
  );
  return runId;
}

function sha256File(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function pdfPageCount(pdfPath: string): number {
  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const match = info.match(/Pages:\s+(\d+)/);
  if (!match) throw new Error(`pdfinfo missing Pages for ${pdfPath}`);
  return Number(match[1]);
}

function assertPdfNationalIdFormat(pdfPath: string, label: string) {
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  const ids = text.match(/\d{14}/g) ?? [];
  if (ids.length === 0) {
    throw new Error(`${label}: expected at least one 14-digit national ID in PDF ${pdfPath}`);
  }
}

function assertMandatoryHandoverClauses(pdfPath: string, variant: string) {
  assertPdfNationalIdFormat(pdfPath, variant);
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  if (!/مخالف|الإلتزامات|فسخ العقد/u.test(text)) {
    throw new Error(`${pdfPath}: missing violations clause block (Green/Jura handover)`);
  }
  if (variant.includes("no-insurance")) {
    if (/تأمين الأعمال/u.test(text) && /بشيك تأمين/u.test(text)) {
      throw new Error(`${pdfPath}: no-insurance variant must not include deposit insurance clause`);
    }
  } else if (variant.startsWith("green-avenue")) {
    if (!/تأمين/u.test(text)) {
      throw new Error(`${pdfPath}: Green deposit variant missing insurance clause`);
    }
  }
  if (variant.startsWith("jura")) {
    if (!/ثان/u.test(text) || !/ثالث/u.test(text)) {
      throw new Error(`${pdfPath}: Jura PDF missing numbered section headings`);
    }
  }
  if (/Primary owner:/i.test(text) && text.includes("Unit Handover Record")) {
    throw new Error(`${pdfPath}: generic English pdf-lib template detected`);
  }
}



import { chromium, type Page } from "playwright";
import { authenticator } from "otplib";
import { PrismaClient } from "@prisma/client";

authenticator.options = { window: 5 };

const prisma = new PrismaClient();

const STORE_BASE =
  process.env.HANDOVER_E2E_STORE?.trim() ||
  "/cursor/stores/self/handover-e2e-ui-evidence";
let ARTIFACT_ROOT = STORE_BASE;
const BASE_URL = process.env.AUTH_URL?.trim() || "http://localhost:3000";
const MANIFEST_PATH = path.join(STORE_BASE, "manifest.json");

type Manifest = {
  loginEmail: string;
  units: Array<{ variant: string; unitId: string; unitCode: string }>;
  legacyDraft?: { unitId: string; draftId: string; userEditMarker: string };
};

type LegalEditMeta = {
  editMarker: string;
  phraseOriginal: string;
  phraseReplacement: string;
  deletedSentenceFragment: string;
};

type E2eVariantRecord = {
  locale: string;
  variant: string;
  unitId: string;
  pdfPath: string;
  downloadUrl: string;
  sha256: string;
  pageCount: number;
  pagePngs: string[];
  pagePngCount: number;
};

type E2eReport = {
  executedAt: string;
  baseUrl: string;
  runId: string;
  evidenceRoot: string;
  executionHonesty: Record<string, string | boolean>;
  steps: string[];
  variants: E2eVariantRecord[];
  failed?: boolean;
  error?: string;
  stack?: string;
  regressionUnitTests?: Record<string, unknown>;
};

function loadManifest(): Manifest {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw) as Manifest;
}

function handoverEditorTextarea(page: Page) {
  return page.getByRole("dialog").locator('[data-slot="textarea"]').first();
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
    path.join(STORE_BASE, "two-factor-secret.txt"),
    "utf8"
  ).trim();

  await page.goto(`${BASE_URL}/${locale}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
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
      await page.screenshot({ path: path.join(ARTIFACT_ROOT, "debug-verify-2fa-disabled.png") });
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

function legalEditMarker(locale: "en" | "ar", variant: string): string {
  return locale === "ar"
    ? `LEGAL_E2E_تعديل_${variant}`
    : `LEGAL_E2E_edit_${variant}`;
}

async function getLatestHandoverDraft(unitId: string) {
  return prisma.officialDocumentTextDraft.findFirst({
    where: { unitId, documentType: "HANDOVER_RECORD" },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { versions: true } } },
  });
}

async function assertDbLatestVersionContains(draftId: string, marker: string) {
  const version = await prisma.officialDocumentTextDraftVersion.findFirst({
    where: { draftId },
    orderBy: { createdAt: "desc" },
  });
  if (!version?.body.includes(marker)) {
    throw new Error(
      `DB latest version missing marker "${marker}" (cause: save did not persist editor text)`
    );
  }
  return version;
}

async function resetLegacyDraftForE2e(manifest: Manifest) {
  if (!manifest.legacyDraft) return;
  const { draftId, userEditMarker } = manifest.legacyDraft;
  const userMarker = `${userEditMarker}: legal note added before official master migration.`;
  const body = `Unit Handover Record\n\nProject: GREEN AVENUE\n\n${userMarker}`;
  const enTemplate = await prisma.officialDocumentTemplate.findFirst({
    where: {
      documentType: "HANDOVER_RECORD",
      locale: "en",
      isActive: true,
    },
  });
  if (!enTemplate) throw new Error("Missing en HANDOVER_RECORD template for legacy reset");

  const admin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("Missing SUPER_ADMIN for legacy reset");

  await prisma.unitGeneratedDocument.deleteMany({ where: { textDraftId: draftId } });
  await prisma.officialDocumentTextDraftVersion.deleteMany({ where: { draftId } });
  await prisma.officialDocumentTextDraft.update({
    where: { id: draftId },
    data: {
      templateId: enTemplate.id,
      templateVersion: enTemplate.version,
      templateLocale: "en",
      title: enTemplate.title,
      currentBody: body,
      handoverTemplateKey: null,
      updatedById: admin.id,
    },
  });
  await prisma.officialDocumentTextDraftVersion.create({
    data: {
      draftId,
      body,
      editedById: admin.id,
    },
  });
}

async function resetMainLoopHandoverDrafts(manifest: Manifest) {
  const unitIds = manifest.units
    .filter(
      (u) => !manifest.legacyDraft || u.unitId !== manifest.legacyDraft.unitId
    )
    .map((u) => u.unitId);
  const drafts = await prisma.officialDocumentTextDraft.findMany({
    where: {
      unitId: { in: unitIds },
      documentType: "HANDOVER_RECORD",
    },
    select: { id: true },
  });
  const draftIds = drafts.map((d) => d.id);
  if (draftIds.length === 0) return;
  await prisma.unitGeneratedDocument.updateMany({
    where: { textDraftId: { in: draftIds } },
    data: { textDraftId: null },
  });
  await prisma.officialDocumentTextDraftVersion.deleteMany({
    where: { draftId: { in: draftIds } },
  });
  await prisma.officialDocumentTextDraft.deleteMany({
    where: { id: { in: draftIds } },
  });
}

async function applyFullLegalEdits(
  page: Page,
  locale: "en" | "ar",
  variant: string
): Promise<{
  editMarker: string;
  phraseOriginal: string;
  phraseReplacement: string;
  deletedSentenceFragment: string;
}> {
  const textarea = handoverEditorTextarea(page);
  await textarea.waitFor({ state: "visible" });
  let body = await textarea.inputValue();

  const phraseMatch = body.match(/مسئ[^\s]+ كاملة/u);
  if (!phraseMatch) {
    throw new Error("E2E setup: declaration phrase for replacement test not found in editor body");
  }
  const phraseOriginal = phraseMatch[0]!;
  const phraseReplacement = `${phraseOriginal} E2E_REPLACED`;

  const deletePattern = variant.startsWith("jura")
    ? /وليس لديه أي تحفظات ، وتم تسليم الوحدة رقم \([^)]*\) بعماره \([^)]*\) بالدور ?\([^)]*\) كامله التشطيب ،/u
    : /وفى حالة مخالفة اياً مما ذكر[\s\S]{0,220}?حكم قضائي\./u;
  const deleteMatch = body.match(deletePattern);
  if (!deleteMatch) {
    throw new Error(
      `E2E setup: optional sentence for deletion test not found (${variant})`
    );
  }
  const deletedSentence = deleteMatch[0]!;
  const deletedSentenceFragment = deletedSentence.slice(0, 40);

  const editMarker = legalEditMarker(locale, variant);
  body = body
    .replace(phraseOriginal, phraseReplacement)
    .replace(deletedSentence, "")
    .trimEnd();
  body = `${body}\n\n${editMarker}`;

  await textarea.fill(body);
  await textarea.dispatchEvent("change");
  await page.waitForTimeout(200);
  const after = await textarea.inputValue();
  if (!after.includes(editMarker) || !after.includes(phraseReplacement)) {
    throw new Error("Editor body missing structured legal edits before save");
  }

  return {
    editMarker,
    phraseOriginal,
    phraseReplacement,
    deletedSentenceFragment,
  };
}

function assertPdfEditFidelity(
  pdfPath: string,
  input: {
    editMarker: string;
    phraseOriginal: string;
    phraseReplacement: string;
    deletedSentenceFragment: string;
  },
  label: string
) {
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  assertPdfContainsMarker(pdfPath, input.editMarker, label);
  if (!text.includes("E2E_REPLACED") && !text.includes(input.phraseReplacement)) {
    throw new Error(`${label}: PDF missing replacement phrase (expected E2E_REPLACED or edited Arabic phrase)`);
  }
  if (text.includes(input.deletedSentenceFragment)) {
    throw new Error(`${label}: PDF still contains deleted sentence fragment`);
  }
  if (!/مخالف|الإلتزامات/u.test(text)) {
    throw new Error(`${label}: unrelated violations block missing after edits`);
  }
}

async function appendMarkerInEditor(
  page: Page,
  _locale: "en" | "ar",
  marker: string
) {
  void _locale;
  const textarea = handoverEditorTextarea(page);
  await textarea.waitFor({ state: "visible" });
  const current = await textarea.inputValue();
  if (current.includes(marker)) return;
  const next = `${current.trimEnd()}\n\n${marker}`;
  await textarea.fill(next);
  await textarea.dispatchEvent("input");
  await textarea.dispatchEvent("change");
  await page.waitForTimeout(200);
  const after = await textarea.inputValue();
  if (!after.includes(marker)) {
    throw new Error(`Editor DOM missing marker after append: ${marker}`);
  }
}

async function saveDraftInDialog(
  page: Page,
  locale: "en" | "ar",
  expectedMarker?: string
) {
  if (expectedMarker) {
    const v = await handoverEditorTextarea(page).inputValue();
    if (!v.includes(expectedMarker)) {
      throw new Error(`Pre-save editor missing marker ${expectedMarker}`);
    }
  }
  await page
    .getByRole("button", {
      name: locale === "ar" ? /حفظ/i : /Save text version/i,
    })
    .click({ force: true });
  await page
    .getByText(locale === "ar" ? /تم حفظ/i : /Draft text saved/i)
    .waitFor({ timeout: 60_000 });
}

async function generateDraftInDialog(page: Page, locale: "en" | "ar") {
  const generateBtn = page.getByRole("button", {
    name: locale === "ar" ? /إنشاء مسودة PDF/i : /Generate draft PDF/i,
  });
  await generateBtn.click({ force: true });
  await page
    .getByText(locale === "ar" ? /تم إنشاء مسودة PDF/i : /Draft PDF generated/i)
    .waitFor({ timeout: 120_000 });
}

async function clickGenerateDraftExpectLegacyBlock(page: Page, locale: "en" | "ar") {
  const generateBtn = page.getByRole("button", {
    name: locale === "ar" ? /إنشاء مسودة PDF/i : /Generate draft PDF/i,
  });
    await generateBtn.click({ force: true });
  await page
    .locator("[data-sonner-toast]")
    .filter({
      hasText:
        /legacy English placeholder still in editor|Save the official Arabic handover text before generating/i,
    })
    .first()
    .waitFor({ timeout: 30_000 });
}

function assertPdfContainsMarker(pdfPath: string, marker: string, label: string) {
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  if (!text.includes(marker)) {
    throw new Error(`${label}: pdftotext missing marker "${marker}" in ${pdfPath}`);
  }
  return text;
}

async function reopenSavedTextDraft(page: Page, locale: "en" | "ar") {
  await page
    .getByRole("heading", {
      name:
        locale === "ar" ?
          /^مسودات نص محفوظة$/
        : /^Saved text drafts$/i,
    })
    .waitFor({ timeout: 30_000 });

  const reopen = page
    .getByRole("button", {
      name: locale === "ar" ? /^إعادة فتح$/ : /^Reopen$/i,
    })
    .first();

  await reopen.waitFor({ state: "visible", timeout: 30_000 });

  const dialogPromise = page.getByRole("dialog").waitFor({
    state: "visible",
    timeout: 120_000,
  });

  await reopen.click();

  try {
    await dialogPromise;
  } catch (err) {
    const toasts = await page.locator("[data-sonner-toast]").allTextContents();
    throw new Error(
      `Reopen draft did not open editor (automation/product). toasts=${JSON.stringify(toasts)} cause=${String(err)}`
    );
  }
}

async function ensureOfficialArabicHandoverBodyLoaded(
  page: Page,
  locale: "en" | "ar"
) {
  const textarea = handoverEditorTextarea(page);
  await textarea.waitFor({ state: "visible", timeout: 60_000 });

  const loadProposed = page.getByRole("button", {
    name: locale === "ar" ? /تحميل النص الرسمي/i : /Load proposed official/i,
  });

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const body = await textarea.inputValue();
    if (/أولاً|اولا/u.test(body) && body.length > 500) {
      return;
    }
    if (
      attempt === 3 &&
      (await loadProposed.isVisible().catch(() => false))
    ) {
      await loadProposed.click();
    }
    await page.waitForTimeout(2000);
  }

  const sample = (await textarea.inputValue()).slice(0, 200);
  throw new Error(
    `Official Arabic handover body never loaded in editor (prepare/race). sample=${JSON.stringify(sample)}`
  );
}

async function openHandoverEditor(page: Page, locale: "en" | "ar") {
  const reopenCount = await page
    .getByRole("button", {
      name: locale === "ar" ? /^إعادة فتح$/ : /^Reopen$/i,
    })
    .count();

  if (reopenCount > 0) {
    await reopenSavedTextDraft(page, locale);
    return;
  }

  const editText = page.getByRole("button", {
    name: locale === "ar" ? /تعديل النص/i : /^Edit text$/i,
  });
  await editText.waitFor({ state: "visible", timeout: 30_000 });
  await editText.click({ force: true });
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 120_000 });
}

async function generateHandoverOnUnit(
  page: Page,
  locale: "en" | "ar",
  unitId: string,
  variant: string,
  screenshotPath: string
): Promise<{
  pdfPath: string;
  downloadUrl: string;
  editMarker: string;
  editMeta: LegalEditMeta;
}> {
  await page.goto(`${BASE_URL}/${locale}/units/${unitId}`, {
    waitUntil: "domcontentloaded",
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

  await ensureOfficialArabicHandoverBodyLoaded(page, locale);

  await page.waitForFunction(
    () => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /Save text version|حفظ/i.test(b.textContent ?? "")
      );
      return Boolean(btn && !(btn as HTMLButtonElement).disabled);
    },
    null,
    { timeout: 120_000 }
  );

  const dialogShot = screenshotPath.replace(".png", "-dialog.png");
  await page.screenshot({ path: dialogShot });

  await page.waitForFunction(
    () => {
      const dialog = document.querySelector('[role="dialog"]');
      const value =
        (dialog?.querySelector('[data-slot="textarea"]') as HTMLTextAreaElement | null)
          ?.value ?? "";
      return /أولاً|اولا|إقرار/u.test(value) && value.length > 500;
    },
    null,
    { timeout: 120_000 }
  );

  const versionCountBefore =
    (await getLatestHandoverDraft(unitId))?._count.versions ?? 0;

  const editMeta = await applyFullLegalEdits(page, locale, variant);
  const { editMarker } = editMeta;
  await saveDraftInDialog(page, locale, editMarker);

  const draft = await getLatestHandoverDraft(unitId);
  if (!draft) throw new Error("No handover draft row after save");
  await assertDbLatestVersionContains(draft.id, editMarker);
  if (draft._count.versions < versionCountBefore + 1) {
    throw new Error(
      `Expected new version row after save (before=${versionCountBefore} after=${draft._count.versions})`
    );
  }

  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});

  await openHandoverEditor(page, locale);
  await page.getByRole("dialog").waitFor({ state: "visible" });
  const reopened = handoverEditorTextarea(page);
  const reopenedBody = await reopened.inputValue();
  if (!reopenedBody.includes(editMarker)) {
    throw new Error(`Reopen editor missing saved marker ${editMarker}`);
  }

  const loadVersionButtons = page.getByRole("button", {
    name: locale === "ar" ? /تحميل في المحرر/i : /Load into editor/i,
  });
  if ((await loadVersionButtons.count()) < 1) {
    throw new Error("Version history missing Load into editor control after save");
  }

  await generateDraftInDialog(page, locale);
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
  const pdfPath = path.join(ARTIFACT_ROOT, "pdfs", `${locale}-${path.basename(href)}.pdf`);
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  await download.saveAs(pdfPath);
  const canonicalPdf = path.join(ARTIFACT_ROOT, "pdfs", `${locale}-${variant}.pdf`);
  const getBuf = await (await page.request.get(`${BASE_URL}${href}`)).body();
  fs.writeFileSync(canonicalPdf, getBuf);
  assertPdfEditFidelity(canonicalPdf, editMeta, "authenticated-GET");
  assertMandatoryHandoverClauses(canonicalPdf, variant);

  return { pdfPath: canonicalPdf, downloadUrl: href, editMarker, editMeta };
}

async function verifyPdfIsOfficial(pdfPath: string, editMarker: string): Promise<void> {
  const buf = fs.readFileSync(pdfPath);
  const head = buf.subarray(0, 5).toString("utf8");
  if (!head.startsWith("%PDF")) throw new Error(`Not a PDF: ${pdfPath}`);
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  if (text.includes("Unit Handover Record") && text.includes("Primary owner:")) {
    throw new Error(`Generic English template detected in ${pdfPath}`);
  }
  if (!/Green Avenue|Jura|جورا|جرين|محض/i.test(text)) {
    throw new Error(`Expected official handover content in ${pdfPath}`);
  }
  assertPdfContainsMarker(pdfPath, editMarker, "verifyPdfIsOfficial");
}

async function runLegacyDraftFlow(
  page: Page,
  locale: "en" | "ar",
  manifest: Manifest
) {
  if (!manifest.legacyDraft) return;
  const { unitId, draftId, userEditMarker } = manifest.legacyDraft;
  const legacyMarker = legalEditMarker(locale, "legacy-after-proposed");

  const versionsBefore = await prisma.officialDocumentTextDraftVersion.count({
    where: { draftId },
  });
  const historyHasUserEdit = await prisma.officialDocumentTextDraftVersion.findFirst({
    where: { draftId, body: { contains: userEditMarker } },
  });
  if (!historyHasUserEdit) {
    throw new Error(
      `Legacy DB seed missing version containing ${userEditMarker} (draftId=${draftId})`
    );
  }

  await page.goto(`${BASE_URL}/${locale}/units/${unitId}`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", {
      name: /Official document drafts|مسودات المستندات الرسمية/i,
    })
    .waitFor({ timeout: 30_000 });

  await reopenSavedTextDraft(page, locale);

  const textarea = handoverEditorTextarea(page);
  const bodyOnReopen = await textarea.inputValue();
  if (!bodyOnReopen.includes(userEditMarker)) {
    throw new Error(
      `${locale} legacy reopen: editor must still show preserved English body with ${userEditMarker}`
    );
  }

  const proposedLoad = page.getByRole("button", {
    name: locale === "ar" ? /تحميل النص الرسمي/i : /Load proposed official/i,
  });
  if (!(await proposedLoad.isVisible())) {
    throw new Error(`${locale} legacy reopen: proposed official body banner missing`);
  }

  await clickGenerateDraftExpectLegacyBlock(page, locale);

  await proposedLoad.click();
  const afterProposed = await textarea.inputValue();
  if (afterProposed.includes(userEditMarker)) {
    throw new Error("Load proposed must replace legacy English body in editor");
  }

  await appendMarkerInEditor(page, locale, legacyMarker);
  await saveDraftInDialog(page, locale);
  await assertDbLatestVersionContains(draftId, legacyMarker);

  const versionsAfterSave = await prisma.officialDocumentTextDraftVersion.count({
    where: { draftId },
  });
  if (versionsAfterSave < versionsBefore + 1) {
    throw new Error(
      `Legacy save must append version (before=${versionsBefore} after=${versionsAfterSave})`
    );
  }

  const stillInHistory = await prisma.officialDocumentTextDraftVersion.findFirst({
    where: { draftId, body: { contains: userEditMarker } },
  });
  if (!stillInHistory) {
    throw new Error("Legacy USER_EDIT_KEEP version row disappeared from DB history");
  }

  await generateDraftInDialog(page, locale);
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 120_000 }).catch(() => {});

  const downloadControl = page
    .getByRole("link", {
      name: locale === "ar" ? /تحميل PDF/i : /Download PDF/i,
    })
    .first();
  await downloadControl.waitFor({ state: "visible", timeout: 60_000 });
  const href = await downloadControl.getAttribute("href");
  if (!href) throw new Error("Legacy flow: missing download href after generate");

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await downloadControl.click();
  const download = await downloadPromise;
  const pdfPath = path.join(ARTIFACT_ROOT, "pdfs", `${locale}-legacy-after-proposed.pdf`);
  await download.saveAs(pdfPath);
  assertPdfContainsMarker(pdfPath, legacyMarker, `legacy-${locale}-download`);
  const getBuf = await (await page.request.get(`${BASE_URL}${href}`)).body();
  const getTmp = path.join(ARTIFACT_ROOT, "pdfs", `.get-${locale}-legacy.pdf`);
  fs.writeFileSync(getTmp, getBuf);
  assertPdfContainsMarker(getTmp, legacyMarker, `legacy-${locale}-GET`);

  await page.screenshot({
    path: path.join(ARTIFACT_ROOT, `legacy-draft-${locale}-editor.png`),
    fullPage: true,
  });

  fs.writeFileSync(
    path.join(ARTIFACT_ROOT, `legacy-draft-${locale}-snapshot.json`),
    JSON.stringify(
      {
        locale,
        passed: true,
        bodyOnReopenIncludesUserEdit: true,
        proposedBannerVisible: true,
        generateBlockedOnLegacyEnglish: true,
        versionsAfterSave,
        historyStillContainsUserEdit: true,
        pdfPath,
        marker: legacyMarker,
      },
      null,
      2
    )
  );
}


function runRegressionUnitTests(): Record<string, unknown> {
  const suites = [
    "__tests__/lib/official-document-approved-request-option.test.ts",
    "__tests__/lib/official-document-mutation-guards.test.ts",
    "__tests__/lib/official-handover-document-locale.test.ts",
    "__tests__/lib/official-handover-draft-body-render.test.ts",
    "__tests__/lib/official-handover-guards.test.ts",
    "__tests__/lib/official-handover-sync-metadata.test.ts",
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

  const runId = initFreshArtifactRun();
  fs.mkdirSync(path.join(ARTIFACT_ROOT, "pages"), { recursive: true });
  fs.mkdirSync(path.join(ARTIFACT_ROOT, "screenshots"), { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const report: E2eReport = {
    executedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    runId,
    evidenceRoot: ARTIFACT_ROOT,
    executionHonesty: {
      browserUiLoginAndPanel: true,
      generateOfficialDocumentAction: "invoked via real UI Generate draft PDF button",
      renderOfficialHandoverRecordPdfOnlyScript:
        "NOT part of this report — see scripts/verify-official-handover-production-flow.ts",
      vitestMocks: "separate regression block below",
      nextJsDevOverlay:
        "Bottom-left “N Issues” in dev is the Next.js dev-tools indicator, not a CRM validation error.",
    },
    steps: [],
    variants: [],
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
      if (locale === "ar") {
        await resetMainLoopHandoverDrafts(manifest);
      }
      const context = await browser.newContext({
        acceptDownloads: true,
        locale: locale === "ar" ? "ar-EG" : "en-US",
      });
      const page = await context.newPage();
      report.steps.push(`${locale}: login (real browser)`);
      await login(page, locale, manifest.loginEmail, password);

      if (legacyOnly) {
        report.steps.push(`${locale}: legacy English draft reopen check`);
        await resetLegacyDraftForE2e(manifest);
        await runLegacyDraftFlow(page, locale, manifest);
        await context.close();
        continue;
      }

      for (const unit of manifest.units) {
        if (
          manifest.legacyDraft &&
          unit.unitId === manifest.legacyDraft.unitId
        ) {
          report.steps.push(
            `${locale}: skip ${unit.variant} in main loop (legacy flow owns this unit)`
          );
          continue;
        }
        const shot = path.join(
          ARTIFACT_ROOT,
          "screenshots",
          `${locale}-${unit.variant}-unit-panel.png`
        );
        report.steps.push(
          `${locale}: unit ${unit.variant} → Edit text → Generate → Download`
        );
        const result = await generateHandoverOnUnit(
          page,
          locale,
          unit.unitId,
          unit.variant,
          shot
        );
        const { pdfPath, downloadUrl } = result;
        const getStatus = await page.request.get(`${BASE_URL}${downloadUrl}`);
        if (!getStatus.ok()) {
          throw new Error(`GET stored document failed: ${getStatus.status()} ${downloadUrl}`);
        }
        const getBuf = await getStatus.body();
        if (!getBuf.subarray(0, 5).toString("utf8").startsWith("%PDF")) {
          throw new Error(`GET body is not PDF for ${downloadUrl}`);
        }
        const pageDir = path.join(ARTIFACT_ROOT, "pages", `${locale}-${unit.variant}`);
        fs.rmSync(pageDir, { recursive: true, force: true });
        const pages = rasterizePdf(pdfPath, pageDir, "page");
        if (pages.length !== pdfPageCount(pdfPath)) {
          throw new Error(`Page PNG count ${pages.length} != pdf pages ${pdfPageCount(pdfPath)} for ${pdfPath}`);
        }
        report.variants.push({
          locale,
          variant: unit.variant,
          unitId: unit.unitId,
          pdfPath,
          downloadUrl,
          sha256: sha256File(pdfPath),
          pageCount: pdfPageCount(pdfPath),
          pagePngs: pages,
          pagePngCount: pages.length,
        });
      }

      report.steps.push(`${locale}: legacy English draft reopen check`);
      await resetLegacyDraftForE2e(manifest);
      await runLegacyDraftFlow(page, locale, manifest);
      await context.close();
    }

    const mainLoopUnits = manifest.units.filter(
      (u) => !manifest.legacyDraft || u.unitId !== manifest.legacyDraft.unitId
    ).length;
    const expectedPdfRows = locales.length * mainLoopUnits;
    if (report.variants.length !== expectedPdfRows) {
      throw new Error(
        `Expected ${expectedPdfRows} variant PDF records (locales=${locales.join(",")} × ${mainLoopUnits} units), got ${report.variants.length}`
      );
    }
    for (const row of report.variants) {
      if (!fs.existsSync(row.pdfPath)) {
        throw new Error(`Missing canonical PDF ${row.pdfPath}`);
      }
      const fromDisk = sha256File(row.pdfPath);
      if (fromDisk !== row.sha256) {
        throw new Error(`SHA256 mismatch for ${row.pdfPath}`);
      }
      if (row.pagePngCount !== row.pageCount) {
        throw new Error(`Page PNG count mismatch for ${row.variant} ${row.locale}`);
      }
    }
  } catch (err) {
    report.failed = true;
    report.error = err instanceof Error ? err.message : String(err);
    report.stack = err instanceof Error ? err.stack : undefined;
  } finally {
    await browser.close();
    await prisma.$disconnect();
    fs.writeFileSync(
      path.join(ARTIFACT_ROOT, "e2e-report.json"),
      JSON.stringify(report, null, 2)
    );
    console.log("E2E report written:", path.join(ARTIFACT_ROOT, "e2e-report.json"));
    if (!report.failed) {
      const totalPages = report.variants.reduce((n, v) => n + v.pageCount, 0);
      console.log("Total page PNGs:", totalPages);
      console.log("E2E PASS", report.variants.length, "canonical PDFs");
    } else {
      process.exit(1);
    }
  }
}

main()
  .then(() => {
    const reportPath = path.join(ARTIFACT_ROOT, "e2e-report.json");
    if (fs.existsSync(reportPath)) {
      const parsed = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
        failed?: boolean;
      };
      if (parsed.failed) process.exitCode = 1;
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
