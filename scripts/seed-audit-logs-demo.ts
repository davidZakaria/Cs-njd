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

  const client = await prisma.client.upsert({
    where: { nationalId: "29901011234567" },
    update: {
      name: "عميل تجريبي للتدقيق",
      phone1: "+201099988776",
      deletedAt: null,
    },
    create: {
      name: "عميل تجريبي للتدقيق",
      nationalId: "29901011234567",
      phone1: "+201099988776",
    },
  });

  const timestamps = [
    new Date(Date.now() - 1000 * 60 * 60 * 3),
    new Date(Date.now() - 1000 * 60 * 60 * 2),
    new Date(Date.now() - 1000 * 60 * 30),
    new Date(),
  ];

  await prisma.auditLog.deleteMany({
    where: {
      recordId: { in: [client.id, superAdmin.id, "filtered-export"] },
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: superAdmin.id,
        action: "UPDATE",
        tableName: "Client",
        recordId: client.id,
        ipAddress: "203.0.113.10",
        timestamp: timestamps[0],
        oldData: {
          name: "عميل قديم",
          phone1: "+201011112222",
          nationalId: "29901011234567",
        },
        newData: {
          name: "عميل تجريبي للتدقيق",
          phone1: "+201099988776",
          nationalId: "29901011234567",
        },
      },
      {
        userId: superAdmin.id,
        action: "PASSWORD_CHANGE",
        tableName: "User",
        recordId: superAdmin.id,
        ipAddress: "203.0.113.11",
        timestamp: timestamps[1],
        oldData: { password: AUDIT_REDACTED },
        newData: { password: { changed: true } },
      },
      {
        userId: superAdmin.id,
        action: "SESSION_REVOKE",
        tableName: "User",
        recordId: superAdmin.id,
        ipAddress: "203.0.113.12",
        timestamp: timestamps[2],
        newData: { sessionVersion: { changed: true } },
      },
      {
        userId: superAdmin.id,
        action: "EXPORT",
        tableName: "AuditLog",
        recordId: "filtered-export",
        ipAddress: "203.0.113.13",
        timestamp: timestamps[3],
        newData: { rowCount: 3, filters: { q: "demo" } },
      },
    ],
  });

  console.log("Seeded audit demo data.");
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