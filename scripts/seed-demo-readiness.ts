/**
 * Demo-ready fake data for Legal, Finance, and Operations walkthroughs.
 * Run after projects exist: npx tsx scripts/seed-demo-readiness.ts
 *
 * Chains seed-screenshot-data for CS/management fixtures, then adds department users,
 * routed requests, archive workflows, and overdue unit-cycle tasks.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import {
  ArchiveFileKind,
  PrismaClient,
  Role,
  UnitCycleStageKey,
  UnitRequestType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { APPROVAL_PATH_BY_TYPE } from "../lib/requests/approval-paths";

const prisma = new PrismaClient();
const TEST_PASSWORD = "TestPassword1234!";
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const MARKER = "demo-readiness";

async function upsertDemoUser(email: string, name: string, role: Role) {
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

function overdueDueDate() {
  return new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
}

function futureDueDate() {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
}

async function ensureUnit(input: {
  projectName: string;
  unitCode: string;
  clientName: string;
  agentId: string;
}) {
  const project =
    (await prisma.project.findFirst({ where: { name: input.projectName } })) ??
    (await prisma.project.create({
      data: { name: input.projectName, unitCycleEnabled: true },
    }));

  const clientSlug = input.unitCode.replace(/[^A-Z0-9]/gi, "").toLowerCase();
  const client =
    (await prisma.client.findFirst({ where: { name: input.clientName } })) ??
    (await prisma.client.create({
      data: {
        name: input.clientName,
        phone1: `0100${clientSlug.slice(-7).padStart(7, "5")}`,
        nationalId: `299${clientSlug.padEnd(11, "0").slice(0, 11)}`,
      },
    }));

  return prisma.unit.upsert({
    where: {
      projectId_unitCode: { projectId: project.id, unitCode: input.unitCode },
    },
    update: { agentId: input.agentId, clientId: client.id },
    create: {
      unitCode: input.unitCode,
      projectId: project.id,
      clientId: client.id,
      agentId: input.agentId,
      area: 120,
    },
  });
}

async function seedDepartmentRequests(
  csId: string,
  units: { id: string; unitCode: string }[]
) {
  const unit = units[0]!;
  const overdue = overdueDueDate();
  const onTime = futureDueDate();

  const specs: Array<{
    type: UnitRequestType;
    overdue: boolean;
    assigned?: Role;
  }> = [
    { type: "CONTRACT_ISSUE_OR_AMENDMENT", overdue: true, assigned: "LEGAL" },
    { type: "GRACE_PERIOD_ANNEX", overdue: false, assigned: "LEGAL" },
    { type: "DOCUMENT_CORRECTION", overdue: false, assigned: "LEGAL" },
    { type: "FINISHING_PRICE_CHANGE_OR_DISCOUNT", overdue: true, assigned: "FINANCE" },
    { type: "PAYMENT_PLAN_CHANGE", overdue: false, assigned: "FINANCE" },
    { type: "REFUND", overdue: true, assigned: "FINANCE" },
    { type: "ARCHIVE_CHECK", overdue: false },
    { type: "ARCHIVE_FILE_REQUEST", overdue: true },
  ];

  for (const spec of specs) {
    const step0 = APPROVAL_PATH_BY_TYPE[spec.type][0] ?? null;
    if (!step0) continue;

    const existing = await prisma.unitRequest.findFirst({
      where: {
        unitId: unit.id,
        type: spec.type,
        description: { startsWith: MARKER },
        deletedAt: null,
      },
    });

    const payload = {
      type: spec.type,
      status: "PENDING" as const,
      unitId: unit.id,
      clientId: (await prisma.unit.findUnique({ where: { id: unit.id }, select: { clientId: true } }))!
        .clientId,
      requestedById: csId,
      description: `${MARKER} — ${spec.type}`,
      dueDate: spec.overdue ? overdue : onTime,
      submittedAt: spec.overdue ? overdue : new Date(),
      currentStepIndex: 0,
      currentApproverKind: step0,
      archiveFilePriority:
        spec.type === "ARCHIVE_FILE_REQUEST" ? ("URGENT" as const) : null,
    };

    let requestId: string;
    if (existing) {
      await prisma.unitRequest.update({ where: { id: existing.id }, data: payload });
      requestId = existing.id;
    } else {
      const created = await prisma.unitRequest.create({ data: payload });
      requestId = created.id;
    }

    if (spec.type === "ARCHIVE_FILE_REQUEST") {
      await prisma.archiveFileRequestItem.deleteMany({
        where: { unitRequestId: requestId },
      });
      await prisma.archiveFileRequestItem.createMany({
        data: [
          { unitRequestId: requestId, fileKind: ArchiveFileKind.CONTRACT },
          { unitRequestId: requestId, fileKind: ArchiveFileKind.NATIONAL_ID },
        ],
      });
    }

    if (spec.type === "ARCHIVE_CHECK") {
      await prisma.archiveCheckItem.deleteMany({
        where: { unitRequestId: requestId },
      });
      await prisma.archiveCheckItem.createMany({
        data: [
          { unitRequestId: requestId, itemKey: "preliminaryContract", status: "FOUND" },
          { unitRequestId: requestId, itemKey: "finalContract", status: "MISSING" },
          { unitRequestId: requestId, itemKey: "handoverRecord", status: "UNSIGNED" },
        ],
      });
      await prisma.archiveCheckGapTask.deleteMany({
        where: { unitRequestId: requestId },
      });
      const gapDue = overdueDueDate();
      await prisma.archiveCheckGapTask.createMany({
        data: [
          {
            unitRequestId: requestId,
            itemKey: "finalContract",
            ownerRole: "LEGAL",
            status: "OPEN",
            deadlineAt: gapDue,
            unitCycleStageKey: "LEGAL_HANDOVER",
          },
          {
            unitRequestId: requestId,
            itemKey: "handoverRecord",
            ownerRole: "FINANCE",
            status: "OPEN",
            deadlineAt: gapDue,
            unitCycleStageKey: "FINANCE",
          },
        ],
      });
    }

    if (spec.assigned === "LEGAL" || spec.assigned === "FINANCE") {
      const owner = await prisma.user.findFirst({
        where: { role: spec.assigned, isActive: true, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
      if (owner) {
        await prisma.unitRequest.update({
          where: { id: requestId },
          data: { assignedApproverUserId: owner.id },
        });
      }
    }
  }
}

async function seedUnitCycleOverdueForUnit(input: {
  unitId: string;
  stageKey: UnitCycleStageKey;
  ownerRole: Role;
  assigneeId: string | null;
  sortOrder: number;
}) {
  const stale = overdueDueDate();
  const cycle = await prisma.unitCycle.upsert({
    where: { unitId: input.unitId },
    update: {},
    create: { unitId: input.unitId },
  });

  await prisma.unitCycleStage.upsert({
    where: {
      unitCycleId_stageKey: { unitCycleId: cycle.id, stageKey: input.stageKey },
    },
    update: {
      status: "IN_PROGRESS",
      ownerRole: input.ownerRole,
      assignedUserId: input.assigneeId,
      startedAt: stale,
      deadlineAt: stale,
    },
    create: {
      unitCycleId: cycle.id,
      stageKey: input.stageKey,
      sortOrder: input.sortOrder,
      ownerRole: input.ownerRole,
      assignedUserId: input.assigneeId,
      status: "IN_PROGRESS",
      startedAt: stale,
      deadlineAt: stale,
    },
  });
}

async function main() {
  console.log("Running seed-screenshot-data baseline…");
  execSync("npx tsx scripts/seed-screenshot-data.ts", {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  const cs =
    (await prisma.user.findUnique({ where: { email: "demo-cs@test.local" } })) ??
    (await upsertDemoUser("demo-cs@test.local", "Demo CS Agent", "CS_AGENT"));

  const legal = await upsertDemoUser(
    "demo-legal@test.local",
    "Demo Legal Officer",
    "LEGAL"
  );
  const finance = await upsertDemoUser(
    "demo-finance@test.local",
    "Demo Finance Officer",
    "FINANCE"
  );
  await upsertDemoUser(
    "demo-ops@test.local",
    "Demo Operations Clerk",
    "OPERATIONS"
  );

  const units = [
    await ensureUnit({
      projectName: "جرين أفنيو",
      unitCode: "DEMO-LEGAL-01",
      clientName: "عميل تجريبي — قانوني",
      agentId: cs.id,
    }),
    await ensureUnit({
      projectName: "جورا",
      unitCode: "DEMO-FIN-01",
      clientName: "عميل تجريبي — مالي",
      agentId: cs.id,
    }),
    await ensureUnit({
      projectName: "جينيسيس",
      unitCode: "DEMO-OPS-01",
      clientName: "عميل تجريبي — عمليات",
      agentId: cs.id,
    }),
  ];

  for (const unit of units) {
    await prisma.contractWorkflow.upsert({
      where: { unitId: unit.id },
      update: {
        handoverStatus: "PENDING",
        hasPreliminarySaleContract: true,
        papersReceived: false,
      },
      create: {
        unitId: unit.id,
        handoverStatus: "PENDING",
        hasPreliminarySaleContract: true,
        contractDate: new Date("2024-01-15"),
        deliveryDate: new Date("2026-06-01"),
      },
    });
  }

  await seedDepartmentRequests(cs.id, units);
  await seedUnitCycleOverdueForUnit({
    unitId: units[0]!.id,
    stageKey: "LEGAL_HANDOVER",
    ownerRole: "LEGAL",
    assigneeId: legal.id,
    sortOrder: 3,
  });
  await seedUnitCycleOverdueForUnit({
    unitId: units[1]!.id,
    stageKey: "FINANCE",
    ownerRole: "FINANCE",
    assigneeId: finance.id,
    sortOrder: 1,
  });
  await seedUnitCycleOverdueForUnit({
    unitId: units[2]!.id,
    stageKey: "FINANCE",
    ownerRole: "FINANCE",
    assigneeId: null,
    sortOrder: 1,
  });

  console.log("\n=== Demo readiness seed complete ===");
  console.log(`Password (all): ${TEST_PASSWORD}`);
  console.log(`TOTP secret (all): ${TOTP_SECRET}`);
  console.log("  Legal:     demo-legal@test.local");
  console.log("  Finance:   demo-finance@test.local");
  console.log("  Operations: demo-ops@test.local");
  console.log("  CS (submitter): demo-cs@test.local");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());