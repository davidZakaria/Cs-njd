/**
 * Reproduce modal "Generate draft PDF" with network + console capture (fake demo data).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { chromium, type Request, type Response } from "playwright";
import { authenticator } from "otplib";

const STORE =
  process.env.HANDOVER_E2E_STORE?.trim() ||
  "/cursor/stores/self/handover-e2e-ui-evidence";
const BASE = process.env.AUTH_URL?.trim() || "http://localhost:3001";
const OUT_DIR = path.join(STORE, "repro-generate-modal", new Date().toISOString().replace(/[:.]/g, "-"));

type NetLog = { dir: "req" | "res"; url: string; method?: string; status?: number; type?: string };

async function login(page: import("playwright").Page, locale: "en" | "ar", email: string, password: string) {
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

async function runLocale(locale: "en" | "ar") {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(STORE, "manifest.json"), "utf8")) as {
    loginEmail: string;
    units: Array<{ unitId: string; variant: string }>;
  };
  const password = process.env.SUPER_ADMIN_PASSWORD!;
  const unit = manifest.units.find((u) => u.variant === "green-avenue")!;

  const consoleLog: string[] = [];
  const netLog: NetLog[] = [];

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({ acceptDownloads: true, locale: locale === "ar" ? "ar-EG" : "en-US" });
  const page = await context.newPage();

  page.on("console", (m) => consoleLog.push(`[${m.type()}] ${m.text()}`));
  page.on("request", (req: Request) => {
    if (req.method() === "POST") {
      netLog.push({ dir: "req", url: req.url(), method: req.method() });
    }
  });
  page.on("response", (res: Response) => {
    if (res.request().method() === "POST") {
      netLog.push({ dir: "res", url: res.url(), status: res.status(), type: res.headers()["content-type"] });
    }
  });

  await login(page, locale, manifest.loginEmail, password);
  await page.goto(`${BASE}/${locale}/units/${unit.unitId}`, { waitUntil: "domcontentloaded" });

  const docType = page.getByText(locale === "ar" ? /نوع المستند/ : /Document type/).locator("..").getByRole("combobox").first();
  if (await docType.isVisible().catch(() => false)) {
    await docType.click();
    await page.getByRole("option", { name: locale === "ar" ? /محضر/ : /Handover record/i }).click();
  }

  const editLabel = locale === "ar" ? "تعديل النص" : "Edit text";
  await page.waitForFunction(
    (needle) => {
      const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(needle)) as HTMLButtonElement | undefined;
      return Boolean(btn && !btn.disabled);
    },
    editLabel,
    { timeout: 120_000 }
  );

  const genBtnBefore = page.getByRole("button", {
    name: locale === "ar" ? /إنشاء مسودة PDF/ : /Generate draft PDF/i,
  });
  const editBtn = page.getByRole("button", { name: locale === "ar" ? /تعديل النص/i : /^Edit text$/i });

  const snap = { editDisabled: await editBtn.isDisabled(), panelGenVisible: await genBtnBefore.isVisible().catch(() => false) };

  await editBtn.click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.locator('[data-slot="textarea"]').first().waitFor({ state: "visible", timeout: 120_000 });

  const modalGen = page.getByRole("dialog").getByRole("button", {
    name: locale === "ar" ? /إنشاء مسودة PDF/ : /Generate draft PDF/i,
  });
  const modalSave = page.getByRole("dialog").getByRole("button", {
    name: locale === "ar" ? /حفظ نسخة النص/ : /Save text version/i,
  });

  const genStateBefore = {
    disabled: await modalGen.isDisabled(),
    label: await modalGen.innerText(),
    ariaDisabled: await modalGen.getAttribute("disabled"),
    dataDisabled: await modalGen.getAttribute("data-disabled"),
  };

  await page.screenshot({ path: path.join(OUT_DIR, `${locale}-before-save.png`), fullPage: true });

  await modalSave.click();
  await page.locator("[data-sonner-toast]").filter({ hasText: locale === "ar" ? /تم حفظ نص المسودة/ : /Draft text saved/ }).first().waitFor({ timeout: 120_000 });

  const genStateAfterSave = {
    disabled: await modalGen.isDisabled(),
    label: await modalGen.innerText(),
  };

  await page.screenshot({ path: path.join(OUT_DIR, `${locale}-after-save.png`), fullPage: true });

  const downloadWait = page.waitForEvent("download", { timeout: 180_000 }).catch(() => null);
  await modalGen.click({ force: genStateAfterSave.disabled });

  const outcome: Record<string, unknown> = { clickedWhileDisabled: genStateAfterSave.disabled };
  try {
    await page.locator("[data-sonner-toast]").filter({ hasText: locale === "ar" ? /تم إنشاء مسودة PDF|تعذر|Cannot/ : /Draft PDF generated|failed|Cannot/i }).first().waitFor({ timeout: 180_000 });
    outcome.toasts = await page.locator("[data-sonner-toast]").allTextContents();
  } catch (e) {
    outcome.toastWaitError = String(e);
    outcome.toasts = await page.locator("[data-sonner-toast]").allTextContents();
  }

  const dl = await downloadWait;
  if (dl) {
    const pdfPath = path.join(OUT_DIR, `${locale}-downloaded.pdf`);
    await dl.saveAs(pdfPath);
    outcome.downloaded = pdfPath;
  }

  await page.screenshot({ path: path.join(OUT_DIR, `${locale}-after-generate-click.png`), fullPage: true });

  const report = { locale, snap, genStateBefore, genStateAfterSave, outcome, netLog, consoleLog: consoleLog.slice(-80) };
  fs.writeFileSync(path.join(OUT_DIR, `${locale}-report.json`), JSON.stringify(report, null, 2));
  await browser.close();
  return report;
}

async function main() {
  const en = await runLocale("en");
  const ar = await runLocale("ar");
  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify({ en, ar, outDir: OUT_DIR }, null, 2));
  console.log("Wrote", OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
