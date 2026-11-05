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
  for (const sub of [
    "baseline/pdfs",
    "baseline/pages",
    "edited/pdfs",
    "edited/pages",
    "legacy/pdfs",
    "screenshots",
  ] as const) {
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

/** Exact optional sentence appended then deleted in edited E2E — not part of official master. */
export const E2E_OPTIONAL_DELETE_SENTENCE =
  "جملة اختبار E2E اختيارية للحذف — ليست بندًا في النموذج الرسمي.";

const GREEN_VIOLATIONS_HEADING = "المخالفات المتسببة فى فسخ العقد";

/** Prior Green E2E regex (removed): deleted master voiding clause through حكم قضائي — not used anymore. */
const LEGACY_GREEN_E2E_VOIDING_DELETE_REGEX =
  "وف[ىي] حالة مخالف[ةه] ايا[ًٍ]? مما ذكر … حكم قضائي.";

function countGreenViolationsHeadingInPdf(pdfPath: string): number {
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  const compact = normalizePdfExtractedText(text).replace(/ /g, "");
  const needle = normalizePdfExtractedText(GREEN_VIOLATIONS_HEADING).replace(/ /g, "");
  let count = 0;
  let idx = 0;
  while ((idx = compact.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

function assertGreenMasterBaselinePdf(pdfPath: string, variant: string) {
  if (!variant.includes("green-avenue")) return;
  const headingCount = countGreenViolationsHeadingInPdf(pdfPath);
  if (headingCount !== 1) {
    throw new Error(
      `${pdfPath}: Green violations heading must appear exactly once (found ${headingCount})`
    );
  }
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  if (!/مفسوخ|فسخ/u.test(text) || !/حكم قضائي/u.test(text)) {
    throw new Error(
      `${pdfPath}: baseline Green PDF missing master voiding clause (مفسوخ / حكم قضائي)`
    );
  }
  if (/LEGAL_E2E_/i.test(text)) {
    throw new Error(`${pdfPath}: baseline PDF must not contain LEGAL_E2E test markers`);
  }
}

function assertGreenEditedMasterVoidingPreserved(pdfPath: string, variant: string, label: string) {
  if (!variant.includes("green-avenue")) return;
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  if (!/مفسوخ|فسخ/u.test(text) || !/حكم قضائي/u.test(text)) {
    throw new Error(
      `${label}: edited Green PDF missing master voiding clause — product defect (not an intentional E2E deletion)`
    );
  }
  if (text.includes(E2E_OPTIONAL_DELETE_SENTENCE)) {
    throw new Error(`${label}: PDF still contains deleted E2E optional test sentence`);
  }
  const headingCount = countGreenViolationsHeadingInPdf(pdfPath);
  if (headingCount !== 1) {
    throw new Error(
      `${label}: Green violations heading must appear exactly once (found ${headingCount})`
    );
  }
}



import { chromium, type Page } from "playwright";
import { authenticator } from "otplib";
import { PrismaClient } from "@prisma/client";
import { buildOfficialHandoverFieldValues } from "@/lib/official-documents/handover/field-values";
import { countGreenDualOwnerDeclarationIntros } from "@/lib/official-documents/handover/html/utils";
import type { UnitMergeInput } from "@/lib/official-documents/merge-fields";

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
  deletionManifest: {
    targetKind: "e2e_optional_test_sentence" | "jura_fixture_sentence";
    exactDeletedText: string;
    masterVoidingClauseIntentionallyRemoved: false;
    replacedLegacyGreenVoidingDeleteRegex: string;
  };
};

type E2eVariantRecord = {
  locale: string;
  variant: string;
  unitId: string;
  pdfPath: string;
  downloadUrl: string;
  documentId: string;
  sha256: string;
  pageCount: number;
  pagePngs: string[];
  pagePngCount: number;
  artifactKind: "baseline" | "edited";
};

type E2eReport = {
  executedAt: string;
  baseUrl: string;
  runId: string;
  evidenceRoot: string;
  executionHonesty: Record<string, string | boolean>;
  steps: string[];
  baselineVariants: E2eVariantRecord[];
  editedVariants: E2eVariantRecord[];
  editManifests: Array<{
    locale: string;
    variant: string;
    manifest: LegalEditMeta;
  }>;
  deletionPolicyNote: string;
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
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);

  const submit = page.locator('form button[type="submit"]');
  await submit.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(
    () => {
      const btn = document.querySelector(
        'form button[type="submit"]'
      ) as HTMLButtonElement | null;
      return Boolean(btn && !btn.disabled);
    },
    { timeout: 30_000 }
  );

  await Promise.all([
    page.waitForURL(/\/(en|ar)\/(setup-2fa|verify-2fa|dashboard|units|executive)/, {
      timeout: 90_000,
      waitUntil: "domcontentloaded",
    }),
    submit.click(),
  ]);

  if (page.url().includes("/login")) {
    const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
    throw new Error(
      `Login stayed on login page (harness/product). url=${page.url()} alerts=${JSON.stringify(alerts)}`
    );
  }

  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(twoFactorSecret);
    const tokenInput = page.locator("#token");
    await tokenInput.click();
    await tokenInput.fill("");
    await tokenInput.pressSequentially(code, { delay: 30 });
    const continueBtn = page.locator("form").getByRole("button", { name: /continue|متابعة/i });
    await continueBtn.waitFor({ state: "visible" });
    if (!(await continueBtn.isEnabled())) {
      await page.screenshot({ path: path.join(ARTIFACT_ROOT, "debug-verify-2fa-disabled.png") });
      throw new Error("2FA Continue button stayed disabled after entering code");
    }
    await Promise.all([
      page.waitForURL(/\/(en|ar)\/(dashboard|units|executive)/, {
        timeout: 90_000,
        waitUntil: "domcontentloaded",
      }),
      continueBtn.click(),
    ]);
    return;
  }
  if (page.url().includes("setup-2fa")) {
    throw new Error(
      "E2E user still routed to setup-2fa — run seed-official-handover-e2e-demo to pre-enable 2FA"
    );
  }

  if (!/\/(dashboard|units|executive)/.test(page.url())) {
    throw new Error(`Login did not reach app shell: ${page.url()}`);
  }
}

function legalEditMarker(locale: "en" | "ar", variant: string): string {
  return `LEGAL_E2E_NONCE_${locale}_${variant}`;
}

function normalizePdfExtractedText(text: string): string {
  return text
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\u00ad/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfTextIncludesExactMarker(text: string, marker: string): boolean {
  if (text.includes(marker)) return true;
  const normalized = normalizePdfExtractedText(text);
  const normalizedMarker = normalizePdfExtractedText(marker);
  if (normalized.includes(normalizedMarker)) return true;
  const compact = normalized.replace(/ /g, "");
  const compactMarker = normalizedMarker.replace(/ /g, "");
  return compact.includes(compactMarker);
}

function assertMarkerLocaleInPdf(text: string, marker: string, locale: "en" | "ar") {
  const other = locale === "en" ? "ar" : "en";
  const wrongNeedle = `LEGAL_E2E_NONCE_${other}_`;
  if (text.includes(wrongNeedle)) {
    throw new Error(
      `PDF contains ${other} locale E2E nonce but expected ${locale} marker ${marker}`
    );
  }
}

async function listGeneratedDocumentIds(unitId: string): Promise<string[]> {
  const rows = await prisma.unitGeneratedDocument.findMany({
    where: { unitId },
    orderBy: { generatedAt: "desc" },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function waitForNewGeneratedDocumentId(
  unitId: string,
  knownIds: Set<string>,
  timeoutMs = 120_000
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await prisma.unitGeneratedDocument.findMany({
      where: { unitId },
      orderBy: { generatedAt: "desc" },
      select: { id: true },
    });
    const fresh = rows.find((r) => !knownIds.has(r.id));
    if (fresh) return fresh.id;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for new generated document on unit ${unitId}`);
}

function pdfPageOneText(pdfPath: string): string {
  return execFileSync("pdftotext", ["-f", "1", "-l", "1", pdfPath, "-"], { encoding: "utf8" });
}

async function loadUnitMergeInput(unitId: string): Promise<UnitMergeInput> {
  const unit = await prisma.unit.findUniqueOrThrow({
    where: { id: unitId },
    include: {
      project: true,
      client: {
        include: {
          phones: { orderBy: { sortOrder: "asc" } },
          addresses: { orderBy: { sortOrder: "asc" } },
        },
      },
      unitClients: {
        include: {
          client: {
            include: {
              phones: { orderBy: { sortOrder: "asc" } },
              addresses: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
      contractWorkflow: true,
      finishing: true,
    },
  });
  return unit as unknown as UnitMergeInput;
}

function assertPdfPageContainsValue(
  pageText: string,
  value: string,
  label: string,
  pdfPath: string
) {
  const needle = normalizePdfExtractedText(value);
  if (!needle || needle === "—") return;
  const pageNorm = normalizePdfExtractedText(pageText);
  const compactPage = pageNorm.replace(/ /g, "");
  const compactNeedle = needle.replace(/ /g, "");
  if (label.endsWith("address") && /[A-Za-z]/.test(needle)) {
    const tokens = needle.split(/[\s,]+/).map((t) => t.trim()).filter((t) => t.length > 2);
    for (const token of tokens) {
      if (!compactPage.includes(token.replace(/ /g, ""))) {
        throw new Error(
          `${pdfPath}: page-1 address missing token "${token}" from "${value}" (${label})`
        );
      }
    }
    return;
  }
  if (!compactPage.includes(compactNeedle)) {
    throw new Error(`${pdfPath}: page-1 missing ${label} (expected "${value}")`);
  }
}

async function assertHandoverPdfFieldIntegrity(
  unitId: string,
  pdfPath: string,
  variant: string
) {
  const unit = await loadUnitMergeInput(unitId);
  const { handoverFields } = buildOfficialHandoverFieldValues(unit, "ar");
  const fullText = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  const page1 = pdfPageOneText(pdfPath);

  if (variant.includes("green-avenue-dual")) {
    const intros = countGreenDualOwnerDeclarationIntros(fullText);
    if (intros !== 2) {
      throw new Error(
        `${pdfPath}: expected exactly 2 "أقر أنا الموقع" dual declaration intros, got ${intros}`
      );
    }
    assertPdfPageContainsValue(page1, handoverFields.clientName, "owner1 name", pdfPath);
    assertPdfPageContainsValue(
      page1,
      handoverFields.clientName2 ?? "",
      "owner2 name",
      pdfPath
    );
    assertPdfPageContainsValue(page1, handoverFields.nationalId, "owner1 nationalId", pdfPath);
    assertPdfPageContainsValue(
      page1,
      handoverFields.nationalId2 ?? "",
      "owner2 nationalId",
      pdfPath
    );
  }

  if (variant === "green-avenue" || variant === "green-avenue-no-insurance") {
    assertPdfPageContainsValue(page1, handoverFields.clientName, "owner1 name", pdfPath);
    assertPdfPageContainsValue(page1, handoverFields.phone1, "owner1 phone1", pdfPath);
    assertPdfPageContainsValue(page1, handoverFields.email, "owner1 email", pdfPath);
    assertPdfPageContainsValue(page1, handoverFields.address, "owner1 address", pdfPath);
    assertPdfPageContainsValue(page1, handoverFields.nationalId, "owner1 nationalId", pdfPath);
    const pageNorm = normalizePdfExtractedText(page1);
    const addrTokens = normalizePdfExtractedText(handoverFields.address)
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2);
    const compactPage = pageNorm.replace(/ /g, "");
    const addrPresent = addrTokens.every((t) => compactPage.includes(t.replace(/ /g, "")));
    if (handoverFields.address && handoverFields.address !== "—" && !addrPresent) {
      throw new Error(
        `${pdfPath}: owner1 address tokens missing on page-1 (field association bug)`
      );
    }
  }

  const draft = await getLatestHandoverDraft(unitId);
  if (draft && (variant === "green-avenue" || variant === "green-avenue-no-insurance")) {
    const version = await prisma.officialDocumentTextDraftVersion.findFirst({
      where: { draftId: draft.id },
      orderBy: { createdAt: "desc" },
    });
    const body = version?.body ?? draft.currentBody;
    if (!body.includes(handoverFields.phone1)) {
      throw new Error(`${pdfPath}: saved draft body missing seeded phone1 before PDF render path`);
    }
    if (!body.includes(handoverFields.email)) {
      throw new Error(`${pdfPath}: saved draft body missing seeded email before PDF render path`);
    }
  }
}

function assertPdfArabicOnlyOfficialContent(pdfPath: string) {
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  const englishBoilerplate = [
    "Unit Handover Record",
    "Primary owner:",
    "Grace Period Annex",
    "Contract Amendment",
    "Finishing Contract Summary",
    "Unit Swap Addendum",
  ];
  for (const phrase of englishBoilerplate) {
    if (text.includes(phrase)) {
      throw new Error(
        `${pdfPath}: English official-document boilerplate "${phrase}" — generated PDFs must be Arabic-only`
      );
    }
  }
}

function pdfPageText(pdfPath: string, page: number): string {
  return execFileSync(
    "pdftotext",
    ["-f", String(page), "-l", String(page), pdfPath, "-"],
    { encoding: "utf8" }
  );
}

function assertHandoverPdfLayout(pdfPath: string, variant: string) {
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  if (/\bintro\b/i.test(text)) {
    throw new Error(`${pdfPath}: leaked template metadata label "intro" in PDF text`);
  }
  if (variant.startsWith("jura")) {
    if (/(^|\n)\s*ثان(?:يا|ي)\s*(\n|$)/m.test(text)) {
      throw new Error(`${pdfPath}: bare "ثانيا" line without body in Jura PDF`);
    }
  }
  if (variant.includes("green-avenue-dual")) {
    const ownerLabels = text.match(/1-الاسم/g) ?? [];
    if (ownerLabels.length > 2) {
      throw new Error(
        `${pdfPath}: duplicated Green dual recipient block (${ownerLabels.length}× "1-الاسم")`
      );
    }
    const dupName = text.match(/(Demo Owner[^\n]{0,80})\1/u);
    if (dupName) {
      throw new Error(`${pdfPath}: duplicated owner name fragment in Green dual PDF`);
    }
  }
  const pageDir = path.join(path.dirname(pdfPath), ".layout-check", path.basename(pdfPath, ".pdf"));
  fs.rmSync(pageDir, { recursive: true, force: true });
  const pngs = rasterizePdf(pdfPath, pageDir, "p");
  const lastPng = pngs[pngs.length - 1];
  if (lastPng && fs.statSync(lastPng).size < 12_000) {
    throw new Error(`${pdfPath}: last page appears nearly blank (${lastPng})`);
  }
  const pageCount = pdfPageCount(pdfPath);
  const lastPageText = pdfPageText(pdfPath, pageCount);
  if (/LEGAL_E2E_/i.test(lastPageText)) {
    const substantive = normalizePdfExtractedText(lastPageText)
      .replace(/LEGAL_E2E_[^\s]+/gi, "")
      .replace(/مسودة|DRAFT/gi, "")
      .replace(/[^\p{L}\p{N}]/gu, "");
    if (substantive.length < 40) {
      throw new Error(
        `${pdfPath}: appended LEGAL_E2E marker isolated on near-blank final page (pagination bug)`
      );
    }
  }
  if (variant.includes("green-avenue")) {
    const headingCount = countGreenViolationsHeadingInPdf(pdfPath);
    if (headingCount !== 1) {
      throw new Error(
        `${pdfPath}: Green violations heading count ${headingCount} (expected exactly 1)`
      );
    }
  }
  const fullText = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  if (variant === "green-avenue" && /LEGAL_E2E_/i.test(fullText)) {
    const page3 = pdfPageText(pdfPath, Math.min(3, pageCount));
    if (!page3.includes("LEGAL_E2E_")) {
      throw new Error(
        `${pdfPath}: green-avenue LEGAL_E2E marker must stay on page 3 with insurance tail, not a trailing orphan page`
      );
    }
  }
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
  const { unitId, userEditMarker } = manifest.legacyDraft;
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

  let draft = await prisma.officialDocumentTextDraft.findFirst({
    where: { unitId, documentType: "HANDOVER_RECORD" },
    orderBy: { updatedAt: "desc" },
  });
  if (!draft) {
    draft = await prisma.officialDocumentTextDraft.create({
      data: {
        unitId,
        documentType: "HANDOVER_RECORD",
        templateId: enTemplate.id,
        templateVersion: enTemplate.version,
        templateLocale: "en",
        title: enTemplate.title,
        currentBody: body,
        handoverTemplateKey: null,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  } else {
    await prisma.officialDocumentTextDraft.update({
      where: { id: draft.id },
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
  }

  manifest.legacyDraft.draftId = draft.id;
  await prisma.officialDocumentTextDraftVersion.deleteMany({ where: { draftId: draft.id } });
  await prisma.officialDocumentTextDraftVersion.create({
    data: {
      draftId: draft.id,
      body,
      editedById: admin.id,
    },
  });
}

async function resetMainLoopHandoverDrafts(manifest: Manifest) {
  const unitIds = manifest.units.map((u) => u.unitId);
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
): Promise<LegalEditMeta> {
  const textarea = handoverEditorTextarea(page);
  await textarea.waitFor({ state: "visible" });
  let body = await textarea.inputValue();

  const phraseMatch = body.match(/مسئ[^\s]+ كاملة/u);
  if (!phraseMatch) {
    throw new Error("E2E setup: declaration phrase for replacement test not found in editor body");
  }
  const phraseOriginal = phraseMatch[0]!;
  const phraseReplacement = `${phraseOriginal} E2E_REPLACED`;

  let exactDeletedText: string;
  let targetKind: "e2e_optional_test_sentence" | "jura_fixture_sentence";
  let deletedSentenceFragment: string;

  if (variant.startsWith("jura")) {
    const deletePattern =
      /وليس لديه أي تحفظات ، وتم تسليم الوحدة رقم \([^)]*\) بعماره \([^)]*\) بالدور ?\([^)]*\) كامله التشطيب ،/u;
    const deleteMatch = body.match(deletePattern);
    if (!deleteMatch) {
      throw new Error(
        `E2E setup: Jura fixture sentence for deletion test not found (${variant})`
      );
    }
    exactDeletedText = deleteMatch[0]!;
    targetKind = "jura_fixture_sentence";
    deletedSentenceFragment = exactDeletedText.slice(0, 40);
    body = body.replace(exactDeletedText, "").trimEnd();
  } else {
    targetKind = "e2e_optional_test_sentence";
    exactDeletedText = E2E_OPTIONAL_DELETE_SENTENCE;
    deletedSentenceFragment = exactDeletedText.slice(0, 40);
    if (!body.includes(exactDeletedText)) {
      body = `${body.trimEnd()}\n\n${exactDeletedText}`;
    }
    body = body.replace(exactDeletedText, "").replace(/\n{3,}/g, "\n\n").trimEnd();
  }

  const editMarker = legalEditMarker(locale, variant);
  body = body.replace(phraseOriginal, phraseReplacement).trimEnd();
  body = `${body}\n\n${editMarker}`;

  await textarea.fill(body);
  await textarea.dispatchEvent("change");
  await page.waitForTimeout(200);
  const after = await textarea.inputValue();
  if (!after.includes(editMarker) || !after.includes(phraseReplacement)) {
    throw new Error("Editor body missing structured legal edits before save");
  }
  if (targetKind === "e2e_optional_test_sentence" && after.includes(exactDeletedText)) {
    throw new Error("Saved editor body still contains E2E optional delete sentence");
  }

  return {
    editMarker,
    phraseOriginal,
    phraseReplacement,
    deletedSentenceFragment,
    deletionManifest: {
      targetKind,
      exactDeletedText,
      masterVoidingClauseIntentionallyRemoved: false,
      replacedLegacyGreenVoidingDeleteRegex: LEGACY_GREEN_E2E_VOIDING_DELETE_REGEX,
    },
  };
}

function assertPdfEditFidelity(
  pdfPath: string,
  input: LegalEditMeta,
  label: string,
  locale: "en" | "ar",
  variant: string
) {
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  assertPdfContainsMarker(pdfPath, input.editMarker, label, locale);
  if (!text.includes("E2E_REPLACED") && !text.includes(input.phraseReplacement)) {
    throw new Error(`${label}: PDF missing replacement phrase (expected E2E_REPLACED or edited Arabic phrase)`);
  }
  if (text.includes(input.deletionManifest.exactDeletedText)) {
    throw new Error(
      `${label}: PDF still contains deleted text (${input.deletionManifest.targetKind}): ${input.deletionManifest.exactDeletedText.slice(0, 50)}…`
    );
  }
  if (input.deletionManifest.targetKind === "jura_fixture_sentence") {
    if (text.includes(input.deletedSentenceFragment)) {
      throw new Error(`${label}: PDF still contains deleted Jura fixture sentence fragment`);
    }
  }
  assertGreenEditedMasterVoidingPreserved(pdfPath, variant, label);
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

async function waitForSonnerToast(page: Page, pattern: RegExp, timeoutMs = 120_000) {
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: pattern })
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs });
}

async function waitForHandoverPanelEditReady(page: Page, locale: "en" | "ar") {
  const label = locale === "ar" ? "تعديل النص" : "Edit text";
  await page.waitForFunction(
    (needle) => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").includes(needle)
      ) as HTMLButtonElement | undefined;
      return Boolean(btn && !btn.disabled);
    },
    label,
    { timeout: 120_000 }
  );
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
  const saveBtn = page.getByRole("button", {
    name: locale === "ar" ? /حفظ نسخة النص/i : /Save text version/i,
  });
  await saveBtn.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(
    (isAr) => {
      const dialog = document.querySelector('[role="dialog"]');
      const buttons = dialog ? [...dialog.querySelectorAll("button")] : [];
      const save = buttons.find((b) =>
        isAr
          ? /حفظ نسخة النص/.test(b.textContent ?? "")
          : /Save text version/i.test(b.textContent ?? "")
      ) as HTMLButtonElement | undefined;
      return Boolean(save && !save.disabled);
    },
    locale === "ar",
    { timeout: 120_000 }
  );

  const toastPattern =
    locale === "ar" ? /تم حفظ نص المسودة/ : /Draft text saved/;
  await Promise.all([
    waitForSonnerToast(page, toastPattern, 120_000),
    saveBtn.click(),
  ]);
}

async function generateDraftInDialog(page: Page, locale: "en" | "ar") {
  const generateBtn = page.getByRole("button", {
    name: locale === "ar" ? /إنشاء مسودة PDF/i : /Generate draft PDF/i,
  });
  await generateBtn.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => {
      const dialog = document.querySelector('[role="dialog"]');
      const buttons = dialog ? [...dialog.querySelectorAll("button")] : [];
      const gen = buttons.find((b) =>
        /Generate draft PDF|إنشاء مسودة PDF/.test(b.textContent ?? "")
      ) as HTMLButtonElement | undefined;
      return Boolean(gen && !gen.disabled);
    },
    { timeout: 120_000 }
  );
  const toastPattern =
    locale === "ar" ? /تم إنشاء مسودة PDF/ : /Draft PDF generated/;
  await Promise.all([
    waitForSonnerToast(page, toastPattern, 180_000),
    generateBtn.click(),
  ]);
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

function pdfTextIncludesMarker(text: string, marker: string): boolean {
  return pdfTextIncludesExactMarker(text, marker);
}

function assertPdfContainsMarker(
  pdfPath: string,
  marker: string,
  label: string,
  locale?: "en" | "ar"
) {
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  if (!pdfTextIncludesExactMarker(text, marker)) {
    throw new Error(`${label}: pdftotext missing exact marker "${marker}" in ${pdfPath}`);
  }
  if (locale) {
    assertMarkerLocaleInPdf(text, marker, locale);
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
  if (await page.getByRole("dialog").isVisible().catch(() => false)) {
    return;
  }

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
  await waitForHandoverPanelEditReady(page, locale);
  await editText.click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 120_000 });
}

async function generateHandoverOnUnit(
  page: Page,
  locale: "en" | "ar",
  unitId: string,
  variant: string,
  screenshotPath: string,
  mode: "baseline" | "edited"
): Promise<{
  pdfPath: string;
  downloadUrl: string;
  editMarker: string;
  editMeta: LegalEditMeta | null;
  documentId: string;
  artifactKind: "baseline" | "edited";
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

  let editMeta: LegalEditMeta | null = null;
  let editMarker = "";
  if (mode === "edited") {
    editMeta = await applyFullLegalEdits(page, locale, variant);
    editMarker = editMeta.editMarker;
    await saveDraftInDialog(page, locale, editMarker);
  } else {
    await saveDraftInDialog(page, locale);
  }

  const draft = await getLatestHandoverDraft(unitId);
  if (!draft) throw new Error("No handover draft row after save");
  if (mode === "edited" && editMeta) {
    await assertDbLatestVersionContains(draft.id, editMarker);
  }
  if (draft._count.versions < versionCountBefore + 1) {
    throw new Error(
      `Expected new version row after save (before=${versionCountBefore} after=${draft._count.versions})`
    );
  }

  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});

  if (mode === "edited" && editMeta) {
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
  }

  const knownDocIds = new Set(await listGeneratedDocumentIds(unitId));
  await openHandoverEditor(page, locale);
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 30_000 });
  await generateDraftInDialog(page, locale);
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});

  const documentId = await waitForNewGeneratedDocumentId(unitId, knownDocIds);
  const downloadUrl = `/api/units/${unitId}/generated-documents/${documentId}`;

  await page.reload({ waitUntil: "domcontentloaded" });
  const downloadLink = page
    .locator(`[data-official-generated-document-id="${documentId}"]`)
    .first();
  await downloadLink.waitFor({ state: "visible", timeout: 60_000 });

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await downloadLink.click();
  const download = await downloadPromise;
  const artifactKind = mode;
  const canonicalPdf = path.join(
    ARTIFACT_ROOT,
    artifactKind,
    "pdfs",
    `${locale}-${variant}.pdf`
  );
  await download.saveAs(canonicalPdf);

  const getStatus = await page.request.get(`${BASE_URL}${downloadUrl}`);
  if (!getStatus.ok()) {
    throw new Error(`GET stored document failed: ${getStatus.status()} ${downloadUrl}`);
  }
  const getBuf = await getStatus.body();
  if (!getBuf.subarray(0, 5).toString("utf8").startsWith("%PDF")) {
    throw new Error(`GET body is not PDF for ${downloadUrl}`);
  }
  fs.writeFileSync(canonicalPdf, getBuf);
  if (mode === "edited" && editMeta) {
    assertPdfEditFidelity(canonicalPdf, editMeta, "authenticated-GET", locale, variant);
  }
  assertMandatoryHandoverClauses(canonicalPdf, variant);
  assertHandoverPdfLayout(canonicalPdf, variant);
  if (mode === "baseline") {
    assertGreenMasterBaselinePdf(canonicalPdf, variant);
  }
  assertPdfArabicOnlyOfficialContent(canonicalPdf);
  await assertHandoverPdfFieldIntegrity(unitId, canonicalPdf, variant);

  return {
    pdfPath: canonicalPdf,
    downloadUrl,
    editMarker,
    editMeta,
    documentId,
    artifactKind,
  };
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

  const knownDocIds = new Set(await listGeneratedDocumentIds(unitId));
  await generateDraftInDialog(page, locale);
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 120_000 }).catch(() => {});

  const documentId = await waitForNewGeneratedDocumentId(unitId, knownDocIds);
  const downloadUrl = `/api/units/${unitId}/generated-documents/${documentId}`;

  await page.reload({ waitUntil: "domcontentloaded" });
  const downloadLink = page
    .locator(`[data-official-generated-document-id="${documentId}"]`)
    .first();
  await downloadLink.waitFor({ state: "visible", timeout: 60_000 });

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await downloadLink.click();
  const download = await downloadPromise;
  const pdfPath = path.join(ARTIFACT_ROOT, "legacy/pdfs", `${locale}-legacy-after-proposed.pdf`);
  await download.saveAs(pdfPath);
  assertPdfContainsMarker(pdfPath, legacyMarker, `legacy-${locale}-download`, locale);

  const getStatus = await page.request.get(`${BASE_URL}${downloadUrl}`);
  if (!getStatus.ok()) {
    throw new Error(`Legacy GET failed: ${getStatus.status()} ${downloadUrl}`);
  }
  const getBuf = await getStatus.body();
  const getTmp = path.join(ARTIFACT_ROOT, "legacy/pdfs", `.get-${locale}-legacy.pdf`);
  fs.writeFileSync(getTmp, getBuf);
  assertPdfContainsMarker(getTmp, legacyMarker, `legacy-${locale}-GET`, locale);

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
    baselineVariants: [],
    editedVariants: [],
    editManifests: [],
    deletionPolicyNote: `Green edited E2E deletes only the exact optional test sentence "${E2E_OPTIONAL_DELETE_SENTENCE}" (master voiding clause preserved). Replaced legacy regex that removed text through حكم قضائي: ${LEGACY_GREEN_E2E_VOIDING_DELETE_REGEX}`,
    variants: [],
  };

  const localeFilter = process.env.HANDOVER_E2E_LOCALES?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) as Array<"en" | "ar"> | undefined;
  const locales: Array<"en" | "ar"> = localeFilter?.length
    ? localeFilter
    : ["en", "ar"];
  if (localeFilter?.length) {
    console.warn(
      `HANDOVER_E2E_LOCALES=${process.env.HANDOVER_E2E_LOCALES} (subset only). Unset for full en+ar matrix.`
    );
  } else {
    console.log("HANDOVER_E2E_LOCALES unset — running full en + ar UI matrix.");
  }
  const legacyOnly = process.env.HANDOVER_E2E_LEGACY_ONLY === "1";
  const skipVitest = process.env.HANDOVER_E2E_SKIP_VITEST === "1";

  if (!skipVitest) {
    report.regressionUnitTests = runRegressionUnitTests();
  }

  try {
    for (const locale of locales) {
      if (!legacyOnly) {
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
        const shot = path.join(
          ARTIFACT_ROOT,
          "screenshots",
          `${locale}-${unit.variant}-baseline-unit-panel.png`
        );
        report.steps.push(
          `${locale}: baseline ${unit.variant} → Edit text → Generate → Download (no edits)`
        );
        const baseline = await generateHandoverOnUnit(
          page,
          locale,
          unit.unitId,
          unit.variant,
          shot,
          "baseline"
        );
        const baselinePageDir = path.join(
          ARTIFACT_ROOT,
          "baseline/pages",
          `${locale}-${unit.variant}`
        );
        fs.rmSync(baselinePageDir, { recursive: true, force: true });
        const baselinePages = rasterizePdf(baseline.pdfPath, baselinePageDir, "page");
        report.baselineVariants.push({
          locale,
          variant: unit.variant,
          unitId: unit.unitId,
          pdfPath: baseline.pdfPath,
          downloadUrl: baseline.downloadUrl,
          documentId: baseline.documentId,
          sha256: sha256File(baseline.pdfPath),
          pageCount: pdfPageCount(baseline.pdfPath),
          pagePngs: baselinePages,
          pagePngCount: baselinePages.length,
          artifactKind: "baseline",
        });
      }

      await resetMainLoopHandoverDrafts(manifest);

      for (const unit of manifest.units) {
        const shot = path.join(
          ARTIFACT_ROOT,
          "screenshots",
          `${locale}-${unit.variant}-edited-unit-panel.png`
        );
        report.steps.push(
          `${locale}: edited ${unit.variant} → replace/delete/append → Generate → Download`
        );
        const edited = await generateHandoverOnUnit(
          page,
          locale,
          unit.unitId,
          unit.variant,
          shot,
          "edited"
        );
        if (!edited.editMeta) {
          throw new Error(`Edited run missing edit manifest for ${locale}-${unit.variant}`);
        }
        report.editManifests.push({
          locale,
          variant: unit.variant,
          manifest: edited.editMeta,
        });
        const editedPageDir = path.join(
          ARTIFACT_ROOT,
          "edited/pages",
          `${locale}-${unit.variant}`
        );
        fs.rmSync(editedPageDir, { recursive: true, force: true });
        const editedPages = rasterizePdf(edited.pdfPath, editedPageDir, "page");
        report.editedVariants.push({
          locale,
          variant: unit.variant,
          unitId: unit.unitId,
          pdfPath: edited.pdfPath,
          downloadUrl: edited.downloadUrl,
          documentId: edited.documentId,
          sha256: sha256File(edited.pdfPath),
          pageCount: pdfPageCount(edited.pdfPath),
          pagePngs: editedPages,
          pagePngCount: editedPages.length,
          artifactKind: "edited",
        });
      }

      report.variants = report.editedVariants;

      report.steps.push(`${locale}: legacy English draft reopen check`);
      await resetLegacyDraftForE2e(manifest);
      await runLegacyDraftFlow(page, locale, manifest);
      await context.close();
    }

    const expectedPerKind = locales.length * manifest.units.length;
    if (report.baselineVariants.length !== expectedPerKind) {
      throw new Error(
        `Expected ${expectedPerKind} baseline PDF records, got ${report.baselineVariants.length}`
      );
    }
    if (report.editedVariants.length !== expectedPerKind) {
      throw new Error(
        `Expected ${expectedPerKind} edited PDF records, got ${report.editedVariants.length}`
      );
    }
    const allRows = [...report.baselineVariants, ...report.editedVariants];
    const juraDualRows = report.editedVariants.filter((v) => v.variant === "jura-dual");
    if (juraDualRows.length === 2) {
      const [a, b] = juraDualRows;
      if (a!.documentId === b!.documentId || a!.sha256 === b!.sha256) {
        throw new Error(
          `en/ar jura-dual must be independent generated documents (shared id=${a!.documentId} sha=${a!.sha256})`
        );
      }
    }
    const docIds = allRows.map((v) => v.documentId);
    if (new Set(docIds).size !== docIds.length) {
      throw new Error("Duplicate generated document IDs across baseline/edited PDF records");
    }
    for (const row of allRows) {
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
      const totalPages =
        report.baselineVariants.reduce((n, v) => n + v.pageCount, 0) +
        report.editedVariants.reduce((n, v) => n + v.pageCount, 0);
      console.log("Total page PNGs:", totalPages);
      console.log(
        "E2E PASS",
        report.baselineVariants.length,
        "baseline +",
        report.editedVariants.length,
        "edited PDFs"
      );
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
