/**
 * Screenshots: Log Call outcome UI + Call Logs inbox (fake seed data only).
 * Usage: npx playwright install && npx tsx scripts/capture-call-logs-walkthrough.ts
 */
import fs from "fs";
import path from "path";
import { chromium, type Page } from "playwright";
import { authenticator } from "otplib";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ARTIFACT_ROOT = "/opt/cursor/artifacts";
const VIEWPORT = { width: 1280, height: 800 };
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const TEST_PASSWORD = "TestPassword1234!";
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);

const prisma = new PrismaClient();

async function ensureUser(email: string, name: string, role: Role) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        password: PASSWORD_HASH,
        is2FAEnabled: true,
        twoFactorSecret: TOTP_SECRET,
        requiresPasswordChange: false,
        isActive: true,
      },
    });
  }
  return prisma.user.create({
    data: {
      email,
      name,
      role,
      password: PASSWORD_HASH,
      is2FAEnabled: true,
      twoFactorSecret: TOTP_SECRET,
      requiresPasswordChange: false,
      isActive: true,
    },
  });
}

async function loginUser(page: Page, locale: "en" | "ar", email: string) {
  await page.goto(`${BASE_URL}/${locale}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor({ state: "visible" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  const submit = page.locator('form button[type="submit"]');
  await submit.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => !document.querySelector('form button[type="submit"]')?.hasAttribute("disabled")
  );
  await Promise.all([
    page.waitForURL(
      /\/(en|ar)\/(setup-2fa|verify-2fa|dashboard|units|cases|notifications)/,
      { timeout: 90_000 }
    ),
    submit.click(),
  ]);
  if (page.url().includes("verify-2fa")) {
    const code = authenticator.generate(TOTP_SECRET);
    const tokenInput = page.locator("#token");
    await tokenInput.fill("");
    await tokenInput.pressSequentially(code, { delay: 30 });
    await Promise.all([
      page.waitForURL(/\/(en|ar)\/(dashboard|units|cases|notifications)/, {
        timeout: 90_000,
      }),
      page.getByRole("button", { name: /continue|متابعة/i }).click(),
    ]);
  }
}

async function seedFixtures() {
  const csAgent = await ensureUser("demo-cs@test.local", "Demo CS Agent", "CS_AGENT");
  const manager = await ensureUser(
    "demo-mgmt@test.local",
    "Demo Manager",
    "MANAGEMENT"
  );
  const community = await ensureUser(
    "demo-community@test.local",
    "Demo Community",
    "COMMUNITY_MANAGEMENT"
  );

  let project = await prisma.project.findFirst({ where: { name: "Walkthrough Call Logs" } });
  if (!project) {
    project = await prisma.project.create({ data: { name: "Walkthrough Call Logs" } });
  }

  const unitCode = "CALLLOG-DEMO";
  let unit = await prisma.unit.findFirst({ where: { unitCode } });
  if (!unit) {
    const client = await prisma.client.create({
      data: {
        name: "Walkthrough Client",
        phone1: "01000009999",
        nationalId: "29901112223300",
      },
    });
    unit = await prisma.unit.create({
      data: {
        unitCode,
        projectId: project.id,
        clientId: client.id,
        agentId: csAgent.id,
      },
    });
  }

  await prisma.notification.deleteMany({
    where: {
      userId: { in: [manager.id, csAgent.id] },
      inboxTab: "CALL_LOG",
    },
  });

  return { unitId: unit.id, unitCode, managerId: manager.id, csAgentId: csAgent.id, communityEmail: community.email };
}

async function captureLogCallDialog(page: Page, locale: "en" | "ar", unitId: string, fileName: string) {
  await loginUser(page, locale, "demo-community@test.local");
  await page.goto(`${BASE_URL}/${locale}/units/${unitId}?tab=timeline`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: /log call|تسجيل مكالمة/i }).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.screenshot({
    path: path.join(ARTIFACT_ROOT, fileName),
    fullPage: false,
  });
}

async function captureCallLogsTab(
  page: Page,
  locale: "en" | "ar",
  email: string,
  fileName: string
) {
  await loginUser(page, locale, email);
  await page.goto(`${BASE_URL}/${locale}/notifications?tab=callLogs`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.screenshot({
    path: path.join(ARTIFACT_ROOT, fileName),
    fullPage: false,
  });
}

async function main() {
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const { unitId } = await seedFixtures();

  const browser = await chromium.launch({ headless: true });

  for (const locale of ["en", "ar"] as const) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
      viewport: VIEWPORT,
    });
    const page = await context.newPage();
    await captureLogCallDialog(
      page,
      locale,
      unitId,
      `call_logs_log_call_dialog_${locale}.png`
    );
    await context.close();
  }

  {
    const context = await browser.newContext({ locale: "en-US", viewport: VIEWPORT });
    const page = await context.newPage();
    await captureCallLogsTab(
      page,
      "en",
      "demo-mgmt@test.local",
      "call_logs_inbox_manager_before_en.png"
    );
    await context.close();
  }

  await import("../lib/notifications/dispatch-activity-notifications").then(
    async ({ dispatchCallLogActivity }) => {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: {
          project: { select: { id: true, name: true } },
          client: { select: { name: true } },
        },
      });
      if (!unit) throw new Error("unit missing");
      const community = await prisma.user.findUnique({
        where: { email: "demo-community@test.local" },
      });
      if (!community) throw new Error("community user missing");
      await dispatchCallLogActivity({
        actorUserId: community.id,
        actorName: community.name ?? "Demo Community",
        unit,
        notes: "📞 عند الاتصال مع العميلة — موعد زيارة الأسبوع القادم",
        callLogOutcome: "ANSWERED",
      });
    }
  );

  {
    const context = await browser.newContext({ locale: "en-US", viewport: VIEWPORT });
    const page = await context.newPage();
    await captureCallLogsTab(
      page,
      "en",
      "demo-mgmt@test.local",
      "call_logs_inbox_manager_after_en.png"
    );
    await context.close();
  }

  for (const locale of ["en", "ar"] as const) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-EG" : "en-US",
      viewport: VIEWPORT,
    });
    const page = await context.newPage();
    await captureCallLogsTab(
      page,
      locale,
      "demo-cs@test.local",
      `call_logs_inbox_cs_agent_${locale}.png`
    );
    await context.close();
  }

  await browser.close();
  console.log(`Call logs walkthrough screenshots → ${ARTIFACT_ROOT}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());