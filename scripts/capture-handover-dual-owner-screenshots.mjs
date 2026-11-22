/**
 * Captures PR screenshots: merged-owner handover dialog, convert confirmation, dual PDFs vs masters.
 */
import { chromium } from "playwright";
import { authenticator } from "otplib";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ARTIFACTS = "/opt/cursor/artifacts";
fs.mkdirSync(ARTIFACTS, { recursive: true });

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const EMAIL = "demo-mgmt@test.local";
const PASSWORD = "TestPassword1234!";
const TOTP = "JBSWY3DPEHPK3PXP";

function readSeedIds() {
  const out = execFileSync("npx", ["tsx", "scripts/seed-handover-merged-owner-ui.ts"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const json = out.match(/\{[\s\S]*\}/);
  if (!json) throw new Error("Could not parse seed output");
  return JSON.parse(json[0]);
}

async function login(page) {
  await page.goto(`${BASE}/en/login`);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  if (page.url().includes("verify-2fa")) {
    await page.fill("input#token", authenticator.generate(TOTP));
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
  }
}

async function shot(page, name, opts = {}) {
  await page.screenshot({
    path: path.join(ARTIFACTS, `${name}.png`),
    ...opts,
  });
  console.log("Saved", `${name}.png`);
}

async function main() {
  const { unitId } = readSeedIds();

  execFileSync("npx", ["tsx", "scripts/generate-official-handover-sample-pdfs.ts"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  const masters = path.join(process.cwd(), "docs/official-documents-samples/handover-masters");
  for (const pair of [
    ["green-avenue-dual-sample-page1.png", "green-avenue-dual-master-page1.png"],
    ["jura-dual-sample-page1.png", "jura-dual-master-page1.png"],
  ]) {
    const [sample, master] = pair;
    const samplePath = path.join(ARTIFACTS, "handover-samples", sample);
    const masterPath = path.join(masters, master);
    if (fs.existsSync(samplePath) && fs.existsSync(masterPath)) {
      fs.copyFileSync(samplePath, path.join(ARTIFACTS, `pdf-${sample}`));
      fs.copyFileSync(masterPath, path.join(ARTIFACTS, `pdf-${master}`));
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(page);

  await page.goto(`${BASE}/en/units/${unitId}`);
  await page.waitForTimeout(2000);

  const docType = page.locator('button:has-text("Handover")').first();
  if (await docType.isVisible().catch(() => false)) {
    await docType.click();
  }

  await page.selectOption?.("select", "HANDOVER_RECORD").catch(() => undefined);

  const editBtn = page.getByRole("button", { name: /Edit text/i });
  await editBtn.click();
  await page.waitForTimeout(2500);

  await shot(page, "handover-merged-generate-dialog-en", { fullPage: false });

  const splitBtn = page.getByTestId("handover-split-merged-owner");
  if (await splitBtn.isVisible()) {
    await splitBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "handover-convert-coowner-confirm-en");
    await page.keyboard.press("Escape");
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});