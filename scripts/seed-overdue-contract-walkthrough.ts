/**
 * Fake data for overdue Contract-stage walkthrough (400+ rows) + large Cases list.
 * Usage: npx tsx scripts/seed-overdue-contract-walkthrough.ts
 */
import "dotenv/config";
import { PrismaClient, Role, UnitCycleStageKey } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const TEST_PASSWORD = "TestPassword1234!";
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const OVERDUE_UNIT_COUNT = 420;
const CASE_COUNT = 120;

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
    },
  });
}

async function main() {
  const mgmt = await upsertUser(
    "demo-mgmt@test.local",
    "Demo Manager",
    "MANAGEMENT"
  );
  await upsertUser("demo-cs@test.local", "Demo CS Agent", "CS_AGENT");

  const project = await prisma.project.upsert({
    where: { name: "GREEN AVENUE" },
    update: {
      unitCycleEnabled: true,
      unitCycleContractDeadlineDays: 5,
    },
    create: {
      name: "GREEN AVENUE",
      unitCycleEnabled: true,
      unitCycleContractDeadlineDays: 5,
    },
  });

  const client = await prisma.client.upsert({
    where: { id: "walkthrough-overdue-client" },
    update: {},
    create: {
      id: "walkthrough-overdue-client",
      name: "Walkthrough Buyer",
      phone1: "01000000001",
    },
  });

  const backfillAt = new Date("2024-06-01T10:00:00.000Z");
  const staleDeadline = new Date("2024-06-03T00:00:00.000Z");

  for (let i = 0; i < OVERDUE_UNIT_COUNT; i += 1) {
    const unitCode = `GA-OVER-${String(i + 1).padStart(4, "0")}`;
    const unit = await prisma.unit.upsert({
      where: {
        projectId_unitCode: { projectId: project.id, unitCode },
      },
      update: {},
      create: {
        unitCode,
        projectId: project.id,
        clientId: client.id,
        agentId: mgmt.id,
        area: 120,
      },
    });

    await prisma.contractWorkflow.upsert({
      where: { unitId: unit.id },
      update: {},
      create: {
        unitId: unit.id,
        contractDate: new Date("2023-05-01T00:00:00.000Z"),
        deliveryDate: new Date("2025-12-01T00:00:00.000Z"),
        handoverStatus: "PENDING",
        hasPreliminarySaleContract: false,
      },
    });

    const cycle = await prisma.unitCycle.upsert({
      where: { unitId: unit.id },
      update: { createdAt: backfillAt, updatedAt: backfillAt },
      create: {
        unitId: unit.id,
        createdAt: backfillAt,
        updatedAt: backfillAt,
      },
    });

    const stages: UnitCycleStageKey[] = [
      "CONTRACT",
      "FINANCE",
      "ENGINEERING",
      "LEGAL_HANDOVER",
    ];
    for (const [sortOrder, stageKey] of stages.entries()) {
      const isContract = stageKey === "CONTRACT";
      await prisma.unitCycleStage.upsert({
        where: {
          unitCycleId_stageKey: { unitCycleId: cycle.id, stageKey },
        },
        update: isContract
          ? {
              status: "IN_PROGRESS",
              ownerRole: "MANAGEMENT",
              startedAt: backfillAt,
              deadlineAt: staleDeadline,
            }
          : {},
        create: {
          unitCycleId: cycle.id,
          stageKey,
          sortOrder,
          ownerRole:
            stageKey === "CONTRACT"
              ? "MANAGEMENT"
              : stageKey === "FINANCE"
                ? "FINANCE"
                : stageKey === "ENGINEERING"
                  ? "LEGAL"
                  : "LEGAL",
          status: isContract ? "IN_PROGRESS" : "NOT_STARTED",
          startedAt: isContract ? backfillAt : null,
          deadlineAt: isContract ? staleDeadline : null,
        },
      });
    }
  }

  for (let i = 0; i < CASE_COUNT; i += 1) {
    const unitCode = `GA-CASE-${String(i + 1).padStart(4, "0")}`;
    const unit = await prisma.unit.upsert({
      where: {
        projectId_unitCode: { projectId: project.id, unitCode },
      },
      update: {},
      create: {
        unitCode,
        projectId: project.id,
        clientId: client.id,
        agentId: mgmt.id,
        area: 95,
      },
    });

    await prisma.ticket.upsert({
      where: { id: `walkthrough-case-${i + 1}` },
      update: {},
      create: {
        id: `walkthrough-case-${i + 1}`,
        unitId: unit.id,
        agentId: mgmt.id,
        category: i % 3 === 0 ? "CUSTOMER_SERVICE" : "GENERAL",
        status: i % 4 === 0 ? "RESOLVED" : "PENDING",
        pendingParty: "NONE",
        notes: `Walkthrough case note ${i + 1} — long text to exercise table wrapping and sticky header behavior in the cases workspace.`,
      },
    });
  }

  console.log(`Seeded ${OVERDUE_UNIT_COUNT} overdue CONTRACT stages.`);
  console.log(`Seeded ${CASE_COUNT} cases.`);
  console.log("Login: demo-mgmt@test.local / TestPassword1234!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());