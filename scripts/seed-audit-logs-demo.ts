/**
 * Seeds fake audit log rows for walkthrough screenshots (local / CI only).
 * Run: npx tsx scripts/seed-audit-logs-demo.ts
 */
import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

import { AUDIT_REDACTED } from "../lib/audit/redact-secrets";

const prisma = new PrismaClient();
const FAKE_PASSWORD = "AuditDemo1234!";
const PASSWORD_HASH = bcrypt.hashSync(FAKE_PASSWORD, 10);
const DEMO_MARKER = "audit-walkthrough-demo";

async function main() {
  const superAdmin = await prisma.user.upsert({
    where: { email: "audit-demo-super@test.local" },
    update: {
      password: PASSWORD_HASH,
      role: "SUPER_ADMIN",
      is2FAEnabled: true,
      twoFactorSecret: "JBSWY3DPEHPK3PXP",
      requiresPasswordChange: false,
      isActive: true,
      deletedAt: null,
      name: "Audit Demo Super",
    },
    create: {
      email: "audit-demo-super@test.local",
      name: "Audit Demo Super",
      password: PASSWORD_HASH,
      role: "SUPER_ADMIN",
      is2FAEnabled: true,
      twoFactorSecret: "JBSWY3DPEHPK3PXP",
      requiresPasswordChange: false,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "audit-demo-agent@test.local" },
    update: {
      password: PASSWORD_HASH,
      role: "CS_AGENT",
      requiresPasswordChange: false,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: "audit-demo-agent@test.local",
      name: "Audit Demo Agent",
      password: PASSWORD_HASH,
      role: "CS_AGENT",
      requiresPasswordChange: false,
    },
  });

  const project =
    (await prisma.project.findFirst({ where: { name: "Audit Demo Project" } })) ??
    (await prisma.project.create({ data: { name: "Audit Demo Project" } }));

  const client = await prisma.client.upsert({
    where: { nationalId: "29901011234567" },
    update: {
      name: "عميل تجريبي للتدقيق",
      phone1: "+201099988776",
      email: "audit-client@test.local",
      deletedAt: null,
    },
    create: {
      name: "عميل تجريبي للتدقيق",
      nationalId: "29901011234567",
      phone1: "+201099988776",
      email: "audit-client@test.local",
    },
  });

  let unit = await prisma.unit.findFirst({
    where: { unitCode: "GA-AUDIT-101", projectId: project.id },
  });
  if (!unit) {
    unit = await prisma.unit.create({
      data: {
        unitCode: "GA-AUDIT-101",
        projectId: project.id,
        clientId: client.id,
        agentId: agent.id,
        area: 145.5,
      },
    });
  }

  let ticket = await prisma.ticket.findFirst({
    where: { unitId: unit.id, notes: { contains: DEMO_MARKER } },
  });
  if (!ticket) {
    ticket = await prisma.ticket.create({
      data: {
        unitId: unit.id,
        agentId: agent.id,
        createdById: superAdmin.id,
        notes: `${DEMO_MARKER} Follow-up on handover docs`,
        category: "GENERAL",
        status: "PENDING",
      },
    });
  }

  let finishing = await prisma.finishing.findFirst({ where: { unitId: unit.id } });
  if (!finishing) {
    finishing = await prisma.finishing.create({
      data: {
        unitId: unit.id,
        finishingType: "CUSTOM",
        totalFinishingPrice: 250_000,
      },
    });
  }

  let workflow = await prisma.contractWorkflow.findFirst({
    where: { unitId: unit.id },
  });
  if (!workflow) {
    workflow = await prisma.contractWorkflow.create({
      data: { unitId: unit.id },
    });
  }

  await prisma.auditLog.deleteMany({});

  await prisma.loginHistory.deleteMany({
    where: { email: "audit-demo-super@test.local" },
  });

  const now = Date.now();
  const ts = (minutesAgo: number) => new Date(now - minutesAgo * 60_000);

  const auditRows = [
    {
      userId: superAdmin.id,
      action: "UPDATE" as const,
      tableName: "Client",
      recordId: client.id,
      ipAddress: "203.0.113.10",
      timestamp: ts(180),
      oldData: {
        name: "عميل قديم",
        phone1: "+201011112222",
        email: "old-client@test.local",
        nationalId: "29901011234567",
      },
      newData: {
        name: "عميل تجريبي للتدقيق",
        phone1: "+201099988776",
        email: "audit-client@test.local",
        nationalId: "29901011234567",
      },
    },
    {
      userId: superAdmin.id,
      action: "UPDATE" as const,
      tableName: "User",
      recordId: agent.id,
      ipAddress: "203.0.113.11",
      timestamp: ts(170),
      oldData: {
        password: AUDIT_REDACTED,
        twoFactorSecret: null,
        is2FAEnabled: false,
      },
      newData: {
        password: { changed: true },
        twoFactorSecret: AUDIT_REDACTED,
        is2FAEnabled: true,
      },
    },
    {
      userId: superAdmin.id,
      action: "PASSWORD_CHANGE" as const,
      tableName: "User",
      recordId: superAdmin.id,
      ipAddress: "203.0.113.12",
      timestamp: ts(160),
      oldData: { password: AUDIT_REDACTED },
      newData: { password: { changed: true } },
    },
    {
      userId: superAdmin.id,
      action: "UPDATE" as const,
      tableName: "Unit",
      recordId: unit.id,
      ipAddress: "203.0.113.13",
      timestamp: ts(150),
      oldData: { area: 140, unitCode: "GA-AUDIT-101" },
      newData: { area: 145.5, unitCode: "GA-AUDIT-101" },
    },
    {
      userId: agent.id,
      action: "CREATE" as const,
      tableName: "Ticket",
      recordId: ticket.id,
      ipAddress: "203.0.113.14",
      timestamp: ts(140),
      newData: {
        unitId: unit.id,
        agentId: agent.id,
        createdById: superAdmin.id,
        status: "PENDING",
        category: "GENERAL",
        notes: `${DEMO_MARKER} Follow-up on handover docs`,
      },
    },
    {
      userId: superAdmin.id,
      action: "UPDATE" as const,
      tableName: "Ticket",
      recordId: ticket.id,
      ipAddress: "203.0.113.15",
      timestamp: ts(130),
      oldData: { status: "PENDING" },
      newData: { status: "ENGINEERING" },
    },
    {
      userId: superAdmin.id,
      action: "UPDATE" as const,
      tableName: "Finishing",
      recordId: finishing.id,
      ipAddress: "203.0.113.16",
      timestamp: ts(120),
      oldData: { totalFinishingPrice: 200_000 },
      newData: { totalFinishingPrice: 250_000 },
    },
    {
      userId: superAdmin.id,
      action: "UPDATE" as const,
      tableName: "ContractWorkflow",
      recordId: workflow.id,
      ipAddress: "203.0.113.17",
      timestamp: ts(110),
      oldData: { handoverStatus: "PENDING" },
      newData: { handoverStatus: "DELIVERY_PROTOCOL" },
    },
    {
      userId: superAdmin.id,
      action: "TWO_FACTOR_RESET" as const,
      tableName: "User",
      recordId: agent.id,
      ipAddress: "203.0.113.18",
      timestamp: ts(100),
      oldData: { twoFactorSecret: AUDIT_REDACTED, is2FAEnabled: true },
      newData: { twoFactorSecret: AUDIT_REDACTED, is2FAEnabled: false },
    },
    {
      userId: superAdmin.id,
      action: "SESSION_REVOKE" as const,
      tableName: "User",
      recordId: agent.id,
      ipAddress: "203.0.113.19",
      timestamp: ts(90),
      newData: { sessionVersion: { changed: true } },
    },
    {
      userId: superAdmin.id,
      action: "DELETE" as const,
      tableName: "ClientPhone",
      recordId: "demo-phone-row",
      ipAddress: "203.0.113.20",
      timestamp: ts(80),
      oldData: { phone: "+201055511111" },
    },
    {
      userId: superAdmin.id,
      action: "CREATE" as const,
      tableName: "ClientAddress",
      recordId: "demo-address-row",
      ipAddress: "203.0.113.21",
      timestamp: ts(70),
      newData: { address: "123 Demo Street, New Cairo" },
    },
    {
      userId: superAdmin.id,
      action: "EXPORT" as const,
      tableName: "AuditLog",
      recordId: "filtered-export",
      ipAddress: "203.0.113.22",
      timestamp: ts(60),
      newData: {
        rowCount: 12,
        filters: {
          q: "demo",
          tableName: "Client",
          dateFrom: "2026-11-01",
        },
      },
    },
    {
      userId: agent.id,
      action: "UPDATE" as const,
      tableName: "Unit",
      recordId: unit.id,
      ipAddress: "203.0.113.23",
      timestamp: ts(50),
      oldData: { assignedEngineerId: null },
      newData: { assignedEngineerId: superAdmin.id },
    },
    {
      userId: superAdmin.id,
      action: "CREATE" as const,
      tableName: "User",
      recordId: agent.id,
      ipAddress: "203.0.113.24",
      timestamp: ts(40),
      newData: {
        name: "Audit Demo Agent",
        email: "audit-demo-agent@test.local",
        role: "CS_AGENT",
      },
    },
  ];

  await prisma.auditLog.createMany({ data: auditRows });

  await prisma.loginHistory.createMany({
    data: [
      {
        email: superAdmin.email,
        userId: superAdmin.id,
        status: "PASSWORD_OK",
        ipAddress: "203.0.113.50",
        userAgent: "Walkthrough/1.0",
        timestamp: ts(35),
      },
      {
        email: superAdmin.email,
        userId: superAdmin.id,
        status: "TWO_FACTOR_FAILED",
        ipAddress: "203.0.113.50",
        userAgent: "Walkthrough/1.0",
        timestamp: ts(34),
      },
      {
        email: superAdmin.email,
        userId: superAdmin.id,
        status: "TWO_FACTOR_SUCCESS",
        ipAddress: "203.0.113.50",
        userAgent: "Walkthrough/1.0",
        timestamp: ts(33),
      },
      {
        email: superAdmin.email,
        userId: superAdmin.id,
        status: "SUCCESS",
        ipAddress: "203.0.113.50",
        userAgent: "Walkthrough/1.0",
        timestamp: ts(32),
      },
      {
        email: "unknown-audit@test.local",
        status: "FAILED",
        ipAddress: "203.0.113.51",
        userAgent: "Walkthrough/1.0",
        timestamp: ts(31),
      },
    ],
  });

  console.log("Seeded audit demo data (15+ audit rows, login history).");
  console.log(`Super admin: ${superAdmin.email} / ${FAKE_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });