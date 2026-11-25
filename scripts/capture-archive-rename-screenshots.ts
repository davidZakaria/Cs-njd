/**
 * Captures archive request type label screenshots (fake data only).
 *
 * Prerequisites:
 *   npx tsx scripts/seed-screenshot-data.ts
 *   Production app on :3000 (next build && next start — no dev overlay)
 *
 *   npx tsx scripts/capture-archive-rename-screenshots.ts
 */
import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { chromium } from "playwright";
import { authenticator } from "otplib";
import {
  ArchiveFileKind,
  PrismaClient,
  UnitRequestType,
} from "@prisma/client";

const prisma = new PrismaClient();

const ARTIFACT_DIR = "/opt/cursor/artifacts/archive-rename";
const BASE_URL = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const TEST_USER_EMAIL = "demo-mgmt@test.local";
const TEST_USER_PASSWORD = "TestPassword1234!";
const TEST_USER_TOTP_SECRET = "JBSWY3DPEHPK3PXP";

const DEMO_REQUEST_MARKER = "archive-rename-screenshot-demo";

async function ensureArchiveLabelDemoRequests() {
  const cs = await prisma.user.findUnique({
    where: { email: "demo-cs@test.local" },
  });
  if (!cs) {
    throw new Error("Run scripts/seed-screenshot-data.ts first");
  }

  const units = await prisma.unit.findMany({
    where: { deletedAt: null },
    take: 3,
    orderBy: { unitCode: "asc" },
    include: { client: true },
  });
  if (units.length < 2) {
    throw new Error("Need at least 2 units — run scripts/seed-screenshot-data.ts");
  }

  await prisma.unitRequest.updateMany({
    where: { description: { startsWith: DEMO_REQUEST_MARKER } },
    data: { deletedAt: new Date() },
  });

  const specs: Array<{
    type: UnitRequestType;
    unitIndex: number;
    description: string;
    archiveFile?: boolean;
  }> = [
    {
      type: UnitRequestType.ARCHIVE_CHECK,
      unitIndex: 0,
      description: `${DEMO_REQUEST_MARKER} contract papers check`,
    },
    {
      type: UnitRequestType.ARCHIVE_FILE_REQUEST,
      unitIndex: 1,
      description: `${DEMO_REQUEST_MARKER} scanned copy request`,
      archiveFile: true,
    },
    {
      type: UnitRequestType.REFUND,
      unitIndex: units.length > 2 ? 2 : 0,
      description: `${DEMO_REQUEST_MARKER} refund (control type)`,
    },
  ];

  for (const spec of specs) {
    const unit = units[spec.unitIndex]!;
    const request = await prisma.unitRequest.create({
      data: {
        type: spec.type,
        status: "PENDING",
        unitId: unit.id,
        clientId: unit.clientId,
        requestedById: cs.id,
        description: spec.description,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        currentStepIndex: 0,
        currentApproverKind:
          spec.type === UnitRequestType.ARCHIVE_FILE_REQUEST ||
          spec.type === UnitRequestType.ARCHIVE_CHECK
            ? "OPERATIONS"
            : "FINANCE",
        unitCycleStageKey:
          spec.type === UnitRequestType.ARCHIVE_CHECK ? "LEGAL_HANDOVER" : null,
        submittedAt: new Date(),
        archiveFilePriority:
          spec.type === UnitRequestType.ARCHIVE_FILE_REQUEST ? "NORMAL" : undefined,
      },
    });
    if (spec.archiveFile) {
      await prisma.archiveFileRequestItem.create({
        data: {
          unitRequestId: request.id,
          fileKind: ArchiveFileKind.NATIONAL_ID,
          status: "PENDING",
        },
      });
    }
  }
}

async function login(page: import("playwright").Page, locale: "en" | "ar") {
  await page.goto(`${BASE_URL}/${locale}/login`);
  await page.waitForSelector('input[name="email"]', { timeout: 30_000 });
  await page.fill('input[name="email"]', TEST_USER_EMAIL);
  await page.fill('input[name="password"]', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(TEST_USER_TOTP_SECRET);
    await page.fill("input#token", code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
  }
}

type ArchiveScreenshotType = "ARCHIVE_CHECK" | "ARCHIVE_FILE_REQUEST";

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await ensureArchiveLabelDemoRequests();

  const browser = await chromium.launch({ headless: true });
  const formShots: Array<{ name: string; locale: "en" | "ar"; type: ArchiveScreenshotType }> = [
    { name: "create-form-en-contract-papers-check", locale: "en", type: "ARCHIVE_CHECK" },
    {
      name: "create-form-en-request-scanned-copies",
      locale: "en",
      type: "ARCHIVE_FILE_REQUEST",
    },
    {
      name: "create-form-ar-contract-papers-check",
      locale: "ar",
      type: "ARCHIVE_CHECK",
    },
    {
      name: "create-form-ar-request-scanned-copies",
      locale: "ar",
      type: "ARCHIVE_FILE_REQUEST",
    },
  ];

  for (const shot of formShots) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await login(page, shot.locale);
    await page.goto(`${BASE_URL}/${shot.locale}/requests?type=${shot.type}&view=all`, {
      waitUntil: "networkidle",
    });
    await page
      .getByText(
        /Contract papers check|Request scanned copies|مراجعة أوراق العقد|طلب نسخ ممسوحة/
      )
      .first()
      .waitFor({ timeout: 30_000 });
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `${shot.name}.png`),
      fullPage: true,
    });
    await page.close();
  }

  for (const locale of ["en", "ar"] as const) {
    const listPage = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await login(listPage, locale);
    await listPage.goto(`${BASE_URL}/${locale}/requests?view=all`, {
      waitUntil: "networkidle",
    });
    await listPage.getByRole("tab", { name: locale === "en" ? /All visible/i : /كل ما يظهر/i }).click();
    await listPage
      .getByText(
        locale === "en"
          ? /Contract papers check|Request scanned copies/
          : /مراجعة أوراق العقد|طلب نسخ ممسوحة/
      )
      .first()
      .waitFor({ timeout: 30_000 });
    await listPage.screenshot({
      path: path.join(ARTIFACT_DIR, `requests-list-${locale}-type-labels.png`),
      fullPage: true,
    });
    await listPage.close();
  }

  await browser.close();
  await prisma.$disconnect();

  console.log(`Screenshots saved under ${ARTIFACT_DIR}`);
}

void main();