/**
 * Dashboard metric parity seed — fake data only (edge cases for count ↔ list).
 * Run: npx tsx scripts/seed-dashboard-parity-demo.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  type HandoverStatus,
  type Role,
  type TicketStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const TEST_PASSWORD = "TestPassword1234!";
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

const DEMO_PROJECT = "Dashboard Parity Demo";

async function upsertUser(email: string, name: string, role: Role) {
  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      role,
      password: PASSWORD_HASH,
      is2FAEnabled: true,
      twoFactorSecret: TOTP_SECRET,
      requiresPasswordChange: false,
      deletedAt: null,
    },
    create: {
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

async function ensureUnit(
  projectId: string,
  unitCode: string,
  opts: {
    agentId?: string | null;
    handover?: HandoverStatus;
    softDeleteWorkflow?: boolean;
    signedProtocolStoredName?: string | null;
    hasPaidFees?: boolean;
    doorFees?: number;
    deliveryDate?: Date;
    noWorkflow?: boolean;
  }
) {
  let unit = await prisma.unit.findFirst({
    where: { projectId, unitCode },
  });
  if (!unit) {
    unit = await prisma.unit.create({
      data: {
        projectId,
        unitCode,
        type: "APARTMENT",
        area: 120,
        agentId: opts.agentId ?? null,
      },
    });
  } else {
    unit = await prisma.unit.update({
      where: { id: unit.id },
      data: { agentId: opts.agentId ?? null, deletedAt: null },
    });
  }

  const workflow = await prisma.contractWorkflow.findUnique({
    where: { unitId: unit.id },
  });

  if (opts.noWorkflow) {
    if (workflow) {
      await prisma.contractWorkflow.update({
        where: { id: workflow.id },
        data: { deletedAt: new Date() },
      });
    }
    return unit;
  }

  const wfData = {
    handoverStatus: opts.handover ?? "PENDING",
    signedProtocolStoredName: opts.signedProtocolStoredName ?? null,
    hasPaidFees: opts.hasPaidFees ?? true,
    deliveryDate: opts.deliveryDate ?? null,
    deletedAt: opts.softDeleteWorkflow ? new Date() : null,
  };

  if (workflow) {
    await prisma.contractWorkflow.update({
      where: { id: workflow.id },
      data: wfData,
    });
  } else {
    await prisma.contractWorkflow.create({
      data: { unitId: unit.id, ...wfData },
    });
  }

  if (opts.doorFees != null) {
    const finishing = await prisma.finishing.findUnique({
      where: { unitId: unit.id },
    });
    if (finishing) {
      await prisma.finishing.update({
        where: { id: finishing.id },
        data: { doorFees: opts.doorFees, deletedAt: null },
      });
    } else {
      await prisma.finishing.create({
        data: {
          unitId: unit.id,
          doorFees: opts.doorFees,
          aluminumFees: 0,
        },
      });
    }
  }

  return unit;
}

async function openTicket(
  unitId: string,
  status: TicketStatus,
  agentId: string | null,
  notes: string,
  opts?: { pendingParty?: string; nextFollowUpDate?: Date; category?: string }
) {
  const existing = await prisma.ticket.findFirst({
    where: { unitId, notes, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.ticket.create({
    data: {
      unitId,
      status,
      agentId,
      notes,
      category: (opts?.category ?? "GENERAL") as "GENERAL",
      pendingParty: (opts?.pendingParty ?? "NONE") as "NONE",
      nextFollowUpDate: opts?.nextFollowUpDate ?? null,
    },
  });
}

export async function seedDashboardParityDemo() {
  console.log("=== Dashboard parity demo seed ===\n");

  const superAdmin = await upsertUser(
    "demo-super@test.local",
    "Demo Super Admin",
    "SUPER_ADMIN"
  );
  const mgmt = await upsertUser(
    "demo-mgmt@test.local",
    "Demo Manager",
    "MANAGEMENT"
  );
  const cs = await upsertUser("demo-cs@test.local", "Demo CS Agent", "CS_AGENT");
  const community = await upsertUser(
    "demo-community@test.local",
    "Demo Community",
    "COMMUNITY_MANAGEMENT"
  );

  const project =
    (await prisma.project.findFirst({ where: { name: DEMO_PROJECT } })) ??
    (await prisma.project.create({ data: { name: DEMO_PROJECT } }));

  // Legal handover: 2 active legal, 1 soft-deleted legal (must NOT count / list as legal)
  await ensureUnit(project.id, "PAR-L1", {
    handover: "DELIVERY_WARNING",
    agentId: cs.id,
  });
  await ensureUnit(project.id, "PAR-L2", {
    handover: "REFUSED_DELIVERY",
    agentId: null,
  });
  await ensureUnit(project.id, "PAR-L3", {
    handover: "DELIVERY_WARNING",
    softDeleteWorkflow: true,
  });

  // Delivered: 1 delivered, 1 protocol
  await ensureUnit(project.id, "PAR-D1", {
    handover: "DELIVERED",
    agentId: cs.id,
  });
  await ensureUnit(project.id, "PAR-D2", {
    handover: "DELIVERY_PROTOCOL",
    agentId: cs.id,
  });

  // Fees outstanding (tracked): has fees + unpaid
  await ensureUnit(project.id, "PAR-FEE1", {
    handover: "PENDING",
    hasPaidFees: false,
    doorFees: 5000,
    agentId: cs.id,
  });

  // Signed protocol tracked: one upload
  await ensureUnit(project.id, "PAR-SP1", {
    handover: "PENDING",
    signedProtocolStoredName: "proto.pdf",
    agentId: cs.id,
  });
  await ensureUnit(project.id, "PAR-SP2", {
    handover: "PENDING",
    signedProtocolStoredName: null,
    agentId: cs.id,
  });

  // Open work / unassigned (team): unit PAR-U1 three tickets no agents; PAR-U2 assigned unit unassigned tickets
  const u1 = await ensureUnit(project.id, "PAR-U1", {
    handover: "PENDING",
    agentId: null,
  });
  const u2 = await ensureUnit(project.id, "PAR-U2", {
    handover: "PENDING",
    agentId: cs.id,
  });
  const u3 = await ensureUnit(project.id, "PAR-U3", {
    handover: "PENDING",
    agentId: null,
  });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await openTicket(u1.id, "PENDING", null, "parity-u1-a");
  await openTicket(u1.id, "PENDING", null, "parity-u1-b");
  await openTicket(u1.id, "LEGAL", null, "parity-u1-c", { category: "LEGAL" });
  await openTicket(u2.id, "PENDING", null, "parity-u2-unassigned-on-assigned-unit");
  await openTicket(u3.id, "ENGINEERING", null, "parity-u3-eng");

  // Follow-up due tickets (2)
  await openTicket(u1.id, "PENDING", cs.id, "parity-followup-1", {
    nextFollowUpDate: yesterday,
  });
  await openTicket(u3.id, "PENDING", null, "parity-followup-2", {
    nextFollowUpDate: yesterday,
  });

  // Assigned CS scoped units (total for cs agent)
  await ensureUnit(project.id, "PAR-CS1", {
    handover: "PENDING",
    agentId: cs.id,
  });
  await ensureUnit(project.id, "PAR-CS2", {
    handover: "DELIVERY_WARNING",
    agentId: cs.id,
  });

  // Total units in project: count all PAR-* 
  const unitCount = await prisma.unit.count({
    where: { projectId: project.id, deletedAt: null },
  });

  console.log("Users (password:", TEST_PASSWORD + ")");
  console.log("  SUPER_ADMIN:", superAdmin.email);
  console.log("  MANAGEMENT:", mgmt.email);
  console.log("  CS_AGENT:", cs.email);
  console.log("  COMMUNITY_MANAGEMENT:", community.email);
  console.log("Project:", project.name, "units:", unitCount);
  console.log("TOTP secret:", TOTP_SECRET);
  console.log("\nSeed complete.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDashboardParityDemo()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}