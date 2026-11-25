/**
 * Captures archive request type label screenshots (fake data only).
 * Prerequisites: npm run db:seed, npx tsx scripts/seed-screenshot-data.ts, app on :3000
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
const BASE_URL = "http://localhost:3000";
const TEST_USER_EMAIL = "demo-mgmt@test.local";
const TEST_USER_PASSWORD = "TestPassword1234!";
const TEST_USER_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const DEMO_UNIT_ID = "cmwvf5e810008jswgjk0pwl8p";

async function ensureArchiveLabelDemoRequests() {
  const cs = await prisma.user.findUnique({
    where: { email: "demo-cs@test.local" },
  });
  const unit = await prisma.unit.findUnique({
    where: { id: DEMO_UNIT_ID },
    include: { client: true },
  });
  if (!cs || !unit) {
    throw new Error("Run scripts/seed-screenshot-data.ts first");
  }

  const existing = await prisma.unitRequest.findMany({
    where: {
      type: { in: ["ARCHIVE_CHECK", "ARCHIVE_FILE_REQUEST"] },
      deletedAt: null,
    },
    select: { type: true },
  });
  const types = new Set(existing.map((r) => r.type));

  if (!types.has(UnitRequestType.ARCHIVE_CHECK)) {
    await prisma.unitRequest.create({
      data: {
        type: UnitRequestType.ARCHIVE_CHECK,
        status: "PENDING",
        unitId: unit.id,
        clientId: unit.clientId,
        requestedById: cs.id,
        description: "Demo contract papers check for label screenshot",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        currentStepIndex: 0,
        currentApproverKind: "OPERATIONS",
        unitCycleStageKey: "LEGAL_HANDOVER",
        submittedAt: new Date(),
      },
    });
  }

  if (!types.has(UnitRequestType.ARCHIVE_FILE_REQUEST)) {
    const request = await prisma.unitRequest.create({
      data: {
        type: UnitRequestType.ARCHIVE_FILE_REQUEST,
        status: "PENDING",
        unitId: unit.id,
        clientId: unit.clientId,
        requestedById: cs.id,
        description: "Demo scanned copy request for label screenshot",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        currentStepIndex: 0,
        currentApproverKind: "OPERATIONS",
        submittedAt: new Date(),
        archiveFilePriority: "NORMAL",
      },
    });
    await prisma.archiveFileRequestItem.create({
      data: {
        unitRequestId: request.id,
        fileKind: ArchiveFileKind.NATIONAL_ID,
        status: "PENDING",
      },
    });
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
  const shots: Array<{ name: string; locale: "en" | "ar"; type: ArchiveScreenshotType }> = [
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

  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await login(page, shot.locale);
    await page.goto(`${BASE_URL}/${shot.locale}/requests?type=${shot.type}`, {
      waitUntil: "networkidle",
    });
    await page.getByText(/Contract papers check|Request scanned copies|مراجعة أوراق العقد|طلب نسخ ممسوحة/).first().waitFor({
      timeout: 30_000,
    });
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `${shot.name}.png`),
      fullPage: true,
    });
    await page.close();
  }

  const listPage = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await login(listPage, "en");
  await listPage.goto(`${BASE_URL}/en/requests`, { waitUntil: "networkidle" });
  await listPage.screenshot({
    path: path.join(ARTIFACT_DIR, "requests-list-en-type-labels.png"),
    fullPage: true,
  });
  await browser.close();
  await prisma.$disconnect();

  console.log(`Screenshots saved under ${ARTIFACT_DIR}`);
}

void main();