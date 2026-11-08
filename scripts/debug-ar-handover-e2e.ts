/**
 * One-shot diagnosis: ar login + save toast (console + network). Not a retry loop.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";
import { authenticator } from "otplib";
import { PrismaClient } from "@prisma/client";

authenticator.options = { window: 5 };

const STORE_BASE =
  process.env.HANDOVER_E2E_STORE?.trim() ||
  "/cursor/stores/self/handover-e2e-ui-evidence";
const BASE_URL = process.env.AUTH_URL?.trim() || "http://localhost:3000";
const OUT = path.join(STORE_BASE, "debug-ar-diagnosis.json");

const prisma = new PrismaClient();

async function main() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(STORE_BASE, "manifest.json"), "utf8")
  ) as { loginEmail: string; units: Array<{ unitId: string; variant: string }> };
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) throw new Error("SUPER_ADMIN_PASSWORD missing");

  const unit = manifest.units.find((u) => u.variant === "green-avenue");
  if (!unit) throw new Error("no green-avenue unit in manifest");

  const log: Record<string, unknown> = {
    at: new Date().toISOString(),
    console: [] as string[],
    failedRequests: [] as string[],
    navigationUrls: [] as string[],
  };

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({ locale: "ar-EG" });
  const page = await context.newPage();

  page.on("console", (msg) => {
    (log.console as string[]).push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("requestfailed", (req) => {
    (log.failedRequests as string[]).push(`${req.method()} ${req.url()} ${req.failure()?.errorText ?? ""}`);
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      (log.navigationUrls as string[]).push(frame.url());
    }
  });

  await page.goto(`${BASE_URL}/ar/login`, { waitUntil: "domcontentloaded" });
  log.afterGoto = page.url();
  log.submitButtonText = await page.locator('form button[type="submit"]').innerText();

  await page.locator('input[name="email"]').fill(manifest.loginEmail);
  await page.locator('input[name="password"]').fill(password);

  await page.waitForFunction(
    () => {
      const btn = document.querySelector('form button[type="submit"]') as HTMLButtonElement | null;
      return Boolean(btn && !btn.disabled);
    },
    { timeout: 30_000 }
  );

  const clickAt = Date.now();
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(3000);
  log.urlAfterSubmit3s = page.url();
  log.msAfterSubmit = Date.now() - clickAt;

  try {
    await page.waitForURL(/\/(ar)\/(setup-2fa|verify-2fa|dashboard|units|executive)/, {
      timeout: 45_000,
      waitUntil: "domcontentloaded",
    });
    log.postLoginUrl = page.url();
  } catch (e) {
    log.loginWaitError = String(e);
    log.postLoginUrl = page.url();
    const alert = await page.locator('[role="alert"]').allTextContents().catch(() => []);
    log.loginAlerts = alert;
  }

  if (page.url().includes("verify-2fa")) {
    const secret = fs.readFileSync(path.join(STORE_BASE, "two-factor-secret.txt"), "utf8").trim();
    const code = authenticator.generate(secret);
    await page.locator("#token").fill(code);
    await page.locator("form").getByRole("button", { name: /continue|متابعة/i }).click();
    await page.waitForURL(/\/(ar)\/(dashboard|units|executive)/, {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });
    log.after2fa = page.url();
  }

  if (!/\/(dashboard|units|executive)/.test(page.url())) {
    log.saveSkipped = "login did not reach app shell";
    fs.writeFileSync(OUT, JSON.stringify(log, null, 2));
    await browser.close();
    await prisma.$disconnect();
    console.log("Wrote", OUT);
    return;
  }

  await page.goto(`${BASE_URL}/ar/units/${unit.unitId}`, { waitUntil: "domcontentloaded" });
  const docTypeTrigger = page
    .getByText(/نوع المستند/i)
    .locator("..")
    .getByRole("combobox")
    .first();
  if (await docTypeTrigger.isVisible().catch(() => false)) {
    await docTypeTrigger.click();
    await page.getByRole("option", { name: /محضر/i }).click();
  }
  await page.waitForFunction(
    () => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").includes("تعديل النص")
      ) as HTMLButtonElement | undefined;
      return Boolean(btn && !btn.disabled);
    },
    { timeout: 120_000 }
  );
  await page.getByRole("button", { name: /تعديل النص/i }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 60_000 });
  const textarea = page.locator('[data-slot="textarea"]').first();
  await textarea.waitFor({ state: "visible", timeout: 60_000 });

  const saveBtn = page.getByRole("button", { name: /حفظ نسخة النص/i });
  log.saveButtonVisible = await saveBtn.isVisible();
  log.saveButtonDisabled = await saveBtn.isDisabled();

  const postResponses: string[] = [];
  page.on("response", (resp) => {
    if (resp.request().method() === "POST" && resp.url().includes(`/ar/units/${unit.unitId}`)) {
      postResponses.push(`${resp.status()} ${resp.url()}`);
    }
  });

  await saveBtn.click({ force: true });
  const toastText = page.locator("[data-sonner-toast]");
  const getByTextToast = page.getByText(/تم حفظ/i);

  try {
    await Promise.race([
      toastText.filter({ hasText: /تم حفظ نص المسودة/ }).first().waitFor({ timeout: 60_000 }),
      getByTextToast.first().waitFor({ timeout: 60_000 }),
    ]);
    log.saveToast = "visible";
    log.sonnerContents = await toastText.allTextContents();
  } catch (e) {
    log.saveToastError = String(e);
    log.sonnerContents = await toastText.allTextContents();
    log.getByTextCount = await getByTextToast.count();
    log.dialogAlerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  }

  log.postResponsesAfterSave = postResponses;
  log.textareaLen = (await textarea.inputValue()).length;

  fs.writeFileSync(OUT, JSON.stringify(log, null, 2));
  console.log("Wrote", OUT);
  await browser.close();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
