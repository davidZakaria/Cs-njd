/**
 * Fake data + digest notifications for late-request walkthrough screenshots.
 * Usage: npx tsx scripts/seed-late-request-digest-walkthrough.ts
 */
import "dotenv/config";
import {
  PrismaClient,
  Role,
  UnitRequestType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { runRequestEscalationJob } from "../lib/requests/escalation";

const prisma = new PrismaClient();
const TEST_PASSWORD = "TestPassword1234!";
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

async function upsertUser(email: string, name: string, role: Role) {
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
        deletedAt: null,
        name,
        role,
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

async function main() {
  await upsertUser(
    "demo-mgmt@test.local",
    "Demo Manager (Walkthrough)",
    "MANAGEMENT"
  );
  await upsertUser(
    "demo-super@test.local",
    "Demo Super Admin",
    "SUPER_ADMIN"
  );
  const cs = await upsertUser("demo-cs@test.local", "Demo CS Agent", "CS_AGENT");

  const project = await prisma.project.upsert({
    where: { name: "GREEN AVENUE" },
    update: {},
    create: { name: "GREEN AVENUE", unitCycleEnabled: true },
  });

  const client = await prisma.client.upsert({
    where: { id: "late-digest-walk-client" },
    update: {},
    create: {
      id: "late-digest-walk-client",
      name: "Late Digest Buyer",
      phone1: "01000009991",
    },
  });

  const overdueDue = new Date("2026-11-01T00:00:00.000Z");

  for (let i = 0; i < 2; i += 1) {
    const unitCode = `GA-LATE-${i + 1}`;
    const unit = await prisma.unit.upsert({
      where: {
        projectId_unitCode: { projectId: project.id, unitCode },
      },
      update: {},
      create: {
        unitCode,
        projectId: project.id,
        clientId: client.id,
        agentId: cs.id,
        area: 110,
      },
    });

    const existing = await prisma.unitRequest.findFirst({
      where: {
        unitId: unit.id,
        type: UnitRequestType.CONTRACT_ISSUE_OR_AMENDMENT,
        deletedAt: null,
      },
    });

    if (existing) {
      await prisma.unitRequest.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          currentApproverKind: "LEGAL",
          dueDate: overdueDue,
          submittedAt: overdueDue,
          lastEscalatedAt: null,
          escalatedToManagement: false,
        },
      });
    } else {
      await prisma.unitRequest.create({
        data: {
          type: UnitRequestType.CONTRACT_ISSUE_OR_AMENDMENT,
          status: "PENDING",
          unitId: unit.id,
          requestedById: cs.id,
          description: "Walkthrough — late legal contract requests",
          currentApproverKind: "LEGAL",
          dueDate: overdueDue,
          submittedAt: overdueDue,
        },
      });
    }
  }

  await runRequestEscalationJob(prisma);

  console.log("Late request walkthrough seed complete.");
  console.log("Management login: demo-mgmt@test.local / TestPassword1234!");
  console.log("Super Admin login: demo-super@test.local / TestPassword1234!");
  console.log("Open /notifications?tab=requests for digest (Management).");
  console.log("Open /requests?overdue=yes&view=all for overdue list.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());