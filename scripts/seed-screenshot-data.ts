/**
 * Seed script for screenshot data - creates test users with 2FA enabled
 * using a known TOTP secret for automation.
 * 
 * Run with: npx tsx scripts/seed-screenshot-data.ts
 */
import "dotenv/config";
import { PrismaClient, UnitRequestType, UnitClientRole, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_PASSWORD = "TestPassword1234!";
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

async function createTestUser(data: {
  email: string;
  name: string;
  role: Role;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
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
      email: data.email,
      name: data.name,
      role: data.role,
      password: PASSWORD_HASH,
      is2FAEnabled: true,
      twoFactorSecret: TOTP_SECRET,
      requiresPasswordChange: false,
    },
  });
}

async function main() {
  console.log("=== Seeding Screenshot Test Data ===\n");
  console.log(`Test password for all users: ${TEST_PASSWORD}\n`);

  // Create test users with 2FA enabled (using known secret for automation)
  console.log("Creating test users (2FA enabled with known secret)...");
  console.log(`  TOTP Secret: ${TOTP_SECRET}`);
  
  const mgmtUser = await createTestUser({
    email: "demo-mgmt@test.local",
    name: "Demo Manager",
    role: "MANAGEMENT",
  });
  console.log(`  Management user: ${mgmtUser.email} (${mgmtUser.id})`);

  const csAgent = await createTestUser({
    email: "demo-cs@test.local",
    name: "Demo CS Agent",
    role: "CS_AGENT",
  });
  console.log(`  CS Agent user: ${csAgent.email} (${csAgent.id})`);

  // Create or find project
  let project = await prisma.project.findFirst({ where: { name: "Demo Towers" } });
  if (!project) {
    project = await prisma.project.create({ data: { name: "Demo Towers" } });
  }
  console.log(`\nUsing project: ${project.name} (${project.id})`);

  // ============================================================
  // MULTI-UNIT CLIENT SCENARIO
  // Create a client who owns multiple units for the badge demo
  // ============================================================
  console.log("\n--- Multi-unit Client Scenario ---");

  let multiUnitClient = await prisma.client.findFirst({
    where: { email: "multiunit-owner@test.local" },
  });
  if (!multiUnitClient) {
    multiUnitClient = await prisma.client.create({
      data: {
        name: "Ahmed Hassan (Multi-unit Owner)",
        phone1: "01001112222",
        nationalId: `NID-MULTI-${Date.now()}`,
        email: "multiunit-owner@test.local",
        address1: "123 Main Street, Cairo",
      },
    });
  }
  console.log(`Multi-unit client: ${multiUnitClient.name} (${multiUnitClient.id})`);

  // Create 3 units owned by this client
  const multiUnits: Array<{ id: string; unitCode: string }> = [];
  for (let i = 1; i <= 3; i++) {
    const unitCode = `MULTI-${i.toString().padStart(3, "0")}`;
    let unit = await prisma.unit.findFirst({ where: { unitCode } });
    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          unitCode,
          projectId: project.id,
          agentId: csAgent.id,
          gracePeriod: "Active until Sep 2026",
        },
      });
      // Create ContractWorkflow with dates
      await prisma.contractWorkflow.upsert({
        where: { unitId: unit.id },
        create: {
          unitId: unit.id,
          deliveryDate: new Date("2026-06-15"),
          contractDate: new Date("2025-01-10"),
        },
        update: {},
      });
      // Create Finishing with type
      await prisma.finishing.upsert({
        where: { unitId: unit.id },
        create: {
          unitId: unit.id,
          finishingType: "FULLY_FINISHED",
        },
        update: {},
      });
    }
    
    // Always ensure PRIMARY owner link exists
    const existingLink = await prisma.unitClient.findFirst({
      where: { unitId: unit.id, clientId: multiUnitClient.id },
    });
    if (!existingLink) {
      await prisma.unitClient.create({
        data: {
          unitId: unit.id,
          clientId: multiUnitClient.id,
          role: "PRIMARY",
        },
      });
      console.log(`  Created PRIMARY link for ${unit.unitCode}`);
    }
    
    multiUnits.push({ id: unit.id, unitCode: unit.unitCode });
    console.log(`  Unit ${i}: ${unit.unitCode} (${unit.id})`);
  }

  // ============================================================
  // TWO-OWNER UNIT SCENARIO
  // Create a unit with PRIMARY and CO_OWNER for the bug demo
  // ============================================================
  console.log("\n--- Two-Owner Unit Scenario ---");

  let primaryOwner = await prisma.client.findFirst({
    where: { email: "primary-owner@test.local" },
  });
  if (!primaryOwner) {
    primaryOwner = await prisma.client.create({
      data: {
        name: "Mohamed Ali (Primary Owner)",
        phone1: "01005556666",
        nationalId: `NID-PRIMARY-${Date.now()}`,
        email: "primary-owner@test.local",
        address1: "456 Second Street, Giza",
      },
    });
  }
  console.log(`Primary owner: ${primaryOwner.name} (${primaryOwner.id})`);

  let coOwner = await prisma.client.findFirst({
    where: { email: "co-owner@test.local" },
  });
  if (!coOwner) {
    coOwner = await prisma.client.create({
      data: {
        name: "Fatma Ibrahim (Co-Owner)",
        phone1: "01007778888",
        nationalId: `NID-COOWNER-${Date.now()}`,
        email: "co-owner@test.local",
        address1: "789 Third Street, Alexandria",
      },
    });
  }
  console.log(`Co-owner: ${coOwner.name} (${coOwner.id})`);

  const twoOwnerUnitCode = "TWO-OWNER-001";
  let twoOwnerUnit = await prisma.unit.findFirst({ where: { unitCode: twoOwnerUnitCode } });
  if (!twoOwnerUnit) {
    twoOwnerUnit = await prisma.unit.create({
      data: {
        unitCode: twoOwnerUnitCode,
        projectId: project.id,
        agentId: csAgent.id,
        gracePeriod: "Active until Nov 2026",
      },
    });
    // Create ContractWorkflow with dates
    await prisma.contractWorkflow.create({
      data: {
        unitId: twoOwnerUnit.id,
        deliveryDate: new Date("2026-08-20"),
        contractDate: new Date("2025-03-15"),
      },
    });
    // Create Finishing with type
    await prisma.finishing.create({
      data: {
        unitId: twoOwnerUnit.id,
        finishingType: "SEMI_FINISHED",
      },
    });
    // Create both owner links
    await prisma.unitClient.create({
      data: {
        unitId: twoOwnerUnit.id,
        clientId: primaryOwner.id,
        role: "PRIMARY",
      },
    });
    await prisma.unitClient.create({
      data: {
        unitId: twoOwnerUnit.id,
        clientId: coOwner.id,
        role: "CO_OWNER",
      },
    });
  }
  console.log(`Two-owner unit: ${twoOwnerUnit.unitCode} (${twoOwnerUnit.id})`);

  // Create a handover request on the two-owner unit for editing demo
  let handoverRequest = await prisma.unitRequest.findFirst({
    where: { unitId: twoOwnerUnit.id, type: "HANDOVER_APPOINTMENT" },
  });
  if (!handoverRequest) {
    handoverRequest = await prisma.unitRequest.create({
      data: {
        type: "HANDOVER_APPOINTMENT",
        status: "PENDING",
        unitId: twoOwnerUnit.id,
        requestedById: csAgent.id,
        description: "Initial handover appointment request - please schedule for next week.",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        currentStepIndex: 0,
        currentApproverKind: "MANAGEMENT",
        submittedAt: new Date(),
      },
    });
    // Add audit event
    await prisma.requestAuditEvent.create({
      data: {
        requestId: handoverRequest.id,
        userId: csAgent.id,
        action: "created",
      },
    });
    await prisma.requestAuditEvent.create({
      data: {
        requestId: handoverRequest.id,
        userId: csAgent.id,
        action: "submitted",
      },
    });
  }
  console.log(`Handover request: ${handoverRequest.id}`);

  // ============================================================
  // DELETE FLOW SCENARIO
  // Create a request that can be deleted for the delete demo
  // ============================================================
  console.log("\n--- Delete Flow Scenario ---");

  const deleteUnitCode = "DELETE-DEMO-001";
  let deleteUnit = await prisma.unit.findFirst({ where: { unitCode: deleteUnitCode } });
  if (!deleteUnit) {
    const deleteClient = await prisma.client.create({
      data: {
        name: "Delete Demo Client",
        phone1: "01009990000",
        nationalId: `NID-DELETE-${Date.now()}`,
        email: "delete-demo@test.local",
        address1: "Delete Street",
      },
    });
    deleteUnit = await prisma.unit.create({
      data: {
        unitCode: deleteUnitCode,
        projectId: project.id,
        agentId: csAgent.id,
        gracePeriod: "N/A",
      },
    });
    // Create ContractWorkflow with dates
    await prisma.contractWorkflow.create({
      data: {
        unitId: deleteUnit.id,
        deliveryDate: new Date("2026-05-01"),
        contractDate: new Date("2025-02-01"),
      },
    });
    // Create Finishing with type
    await prisma.finishing.create({
      data: {
        unitId: deleteUnit.id,
        finishingType: "CORE_AND_SHELL",
      },
    });
    await prisma.unitClient.create({
      data: {
        unitId: deleteUnit.id,
        clientId: deleteClient.id,
        role: "PRIMARY",
      },
    });
  }
  console.log(`Delete demo unit: ${deleteUnit.unitCode} (${deleteUnit.id})`);

  // Create a request that can be deleted
  let deleteRequest = await prisma.unitRequest.findFirst({
    where: { unitId: deleteUnit.id, type: "CONTRACT_ISSUE_OR_AMENDMENT", deletedAt: null },
  });
  if (!deleteRequest) {
    deleteRequest = await prisma.unitRequest.create({
      data: {
        type: "CONTRACT_ISSUE_OR_AMENDMENT",
        status: "PENDING",
        unitId: deleteUnit.id,
        requestedById: csAgent.id,
        description: "This is a test request that will be deleted to demonstrate the delete flow.",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        currentStepIndex: 0,
        currentApproverKind: "LEGAL",
        submittedAt: new Date(),
      },
    });
    await prisma.requestAuditEvent.create({
      data: {
        requestId: deleteRequest.id,
        userId: csAgent.id,
        action: "created",
      },
    });
  }
  console.log(`Delete demo request: ${deleteRequest.id}`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n=== Seed Complete ===\n");
  console.log("Test Users (password: TestPassword1234!):");
  console.log(`  Management: demo-mgmt@test.local`);
  console.log(`  CS Agent:   demo-cs@test.local`);
  console.log("\nTest URLs:");
  console.log(`  Multi-unit badge (EN): /en/units/${multiUnits[0].id}`);
  console.log(`  Multi-unit badge (AR): /ar/units/${multiUnits[0].id}`);
  console.log(`  Two-owner unit:        /en/units/${twoOwnerUnit.id}`);
  console.log(`  Handover request:      /en/requests/${handoverRequest.id}`);
  console.log(`  Delete demo unit:      /en/units/${deleteUnit.id}`);
  console.log(`  Delete demo request:   /en/requests/${deleteRequest.id}`);
  console.log("\nUnit IDs for reference:");
  console.log(`  MULTI_UNIT_ID="${multiUnits[0].id}"`);
  console.log(`  TWO_OWNER_UNIT_ID="${twoOwnerUnit.id}"`);
  console.log(`  HANDOVER_REQUEST_ID="${handoverRequest.id}"`);
  console.log(`  DELETE_UNIT_ID="${deleteUnit.id}"`);
  console.log(`  DELETE_REQUEST_ID="${deleteRequest.id}"`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
