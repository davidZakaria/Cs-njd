/**
 * Minimal walkthrough DB fixtures (Excel phone .0 + duplicate timeline notes).
 * Safe to run on main@0d0b555 worktree or the feature branch (idempotent).
 *
 * Usage: npx tsx scripts/seed-walkthrough-fixtures.ts
 */
import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_PASSWORD = "TestPassword1234!";
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

async function ensureTestUser(email: string, name: string, role: Role) {
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
  console.log("=== Walkthrough fixtures (phone .0 + dup timeline) ===\n");

  const csAgent = await ensureTestUser(
    "demo-cs@test.local",
    "Demo CS Agent",
    "CS_AGENT"
  );

  let project = await prisma.project.findFirst({ where: { name: "جرين أفنيو" } });
  if (!project) {
    project = await prisma.project.create({ data: { name: "جرين أفنيو" } });
  }

  const walkUnitCode = "WALK-DEMO-AR";
  let walkClient = await prisma.client.findFirst({
    where: { email: "walkthrough-ar@test.local" },
  });
  if (!walkClient) {
    walkClient = await prisma.client.create({
      data: {
        name: "عميل تجربة العرض",
        phone1: "96599034830.0",
        nationalId: "28801112223344",
        email: "walkthrough-ar@test.local",
        address1: "شارع ٩ — القاهرة",
      },
    });
  } else {
    walkClient = await prisma.client.update({
      where: { id: walkClient.id },
      data: { phone1: "96599034830.0" },
    });
  }

  let walkUnit = await prisma.unit.findFirst({ where: { unitCode: walkUnitCode } });
  if (!walkUnit) {
    walkUnit = await prisma.unit.create({
      data: {
        unitCode: walkUnitCode,
        projectId: project.id,
        clientId: walkClient.id,
        agentId: csAgent.id,
        gracePeriod: "Active until Dec 2026",
      },
    });
    await prisma.contractWorkflow.create({
      data: {
        unitId: walkUnit.id,
        deliveryDate: new Date("2026-08-01"),
        contractDate: new Date("2025-03-01"),
      },
    });
    await prisma.finishing.create({
      data: {
        unitId: walkUnit.id,
        finishingType: "FULLY_FINISHED",
      },
    });
  } else {
    await prisma.unit.update({
      where: { id: walkUnit.id },
      data: { gracePeriod: "Active until Dec 2026" },
    });
  }

  await prisma.contractWorkflow.upsert({
    where: { unitId: walkUnit.id },
    create: {
      unitId: walkUnit.id,
      deliveryDate: new Date("2026-08-01"),
      contractDate: null,
      finalSaleContractDate: new Date("2025-03-01"),
    },
    update: {
      deliveryDate: new Date("2026-08-01"),
      contractDate: null,
      finalSaleContractDate: new Date("2025-03-01"),
    },
  });
  await prisma.finishing.upsert({
    where: { unitId: walkUnit.id },
    create: {
      unitId: walkUnit.id,
      finishingType: "FULLY_FINISHED",
    },
    update: { finishingType: "FULLY_FINISHED" },
  });

  const dupNote = "ملاحظة متابعة — نفس النص في استيراد Excel";
  const existingDup = await prisma.ticket.count({
    where: { unitId: walkUnit.id, notes: dupNote },
  });
  if (existingDup < 2) {
    await prisma.ticket.create({
      data: {
        unitId: walkUnit.id,
        notes: dupNote,
        category: "CUSTOMER_SERVICE",
        status: "PENDING",
        agentId: csAgent.id,
        pendingParty: "NONE",
      },
    });
    await prisma.ticket.create({
      data: {
        unitId: walkUnit.id,
        notes: dupNote,
        category: "FEEDBACK_HISTORY",
        status: "RESOLVED",
        agentId: csAgent.id,
        pendingParty: "NONE",
      },
    });
  }

  const openTicket = await prisma.ticket.findFirst({
    where: { unitId: walkUnit.id, status: { not: "RESOLVED" } },
  });
  if (!openTicket) {
    await prisma.ticket.create({
      data: {
        unitId: walkUnit.id,
        notes: "متابعة — عمل مفتوح للوحة التحكم",
        category: "CUSTOMER_SERVICE",
        status: "PENDING",
        agentId: csAgent.id,
        pendingParty: "NONE",
      },
    });
  }

  const walkRequest = await prisma.unitRequest.findFirst({
    where: {
      unitId: walkUnit.id,
      type: "CONTRACT_ISSUE_OR_AMENDMENT",
      deletedAt: null,
    },
  });
  if (!walkRequest) {
    await prisma.unitRequest.create({
      data: {
        type: "CONTRACT_ISSUE_OR_AMENDMENT",
        status: "PENDING",
        unitId: walkUnit.id,
        requestedById: csAgent.id,
        description: "Walkthrough — contract date display check",
      },
    });
  }

  const linkedRequest = await prisma.unitRequest.findFirst({
    where: {
      unitId: walkUnit.id,
      type: "CONTRACT_ISSUE_OR_AMENDMENT",
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Walkthrough unit: ${walkUnit.unitCode} (${walkUnit.id})`);
  console.log(`Export: WALKTHROUGH_UNIT_ID=${walkUnit.id}`);
  if (linkedRequest) {
    console.log(`Export: WALKTHROUGH_REQUEST_ID=${linkedRequest.id}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());