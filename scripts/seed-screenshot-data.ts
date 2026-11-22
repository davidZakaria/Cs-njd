/**
 * Seed script for screenshot data - creates test users with 2FA enabled
 * using a known TOTP secret for automation.
 * 
 * Uses REALISTIC data shapes based on production findings:
 * - Merged "/" owner names (e.g., "يوسف شنودة / مريم ماهر")
 * - Units with legacy client + unitClients CO_OWNER
 * - Units with only unitClients (no legacy client)
 * - Multi-unit clients with spelling variations
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
  console.log("=== Seeding Screenshot Test Data (Production-Realistic Shapes) ===\n");
  console.log(`Test password for all users: ${TEST_PASSWORD}`);
  console.log(`TOTP Secret: ${TOTP_SECRET}\n`);

  // Create test users
  console.log("Creating test users...");
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

  // Create or find projects
  let project1 = await prisma.project.findFirst({ where: { name: "جرين أفنيو" } });
  if (!project1) {
    project1 = await prisma.project.create({ data: { name: "جرين أفنيو" } });
  }
  let project2 = await prisma.project.findFirst({ where: { name: "جورا" } });
  if (!project2) {
    project2 = await prisma.project.create({ data: { name: "جورا" } });
  }
  let project3 = await prisma.project.findFirst({ where: { name: "جينيسيس" } });
  if (!project3) {
    project3 = await prisma.project.create({ data: { name: "جينيسيس" } });
  }
  console.log(`\nProjects: ${project1.name}, ${project2.name}, ${project3.name}`);

  // ============================================================
  // CASE 1: MERGED "/" OWNER NAME (most common in production)
  // Client name contains both owners separated by "/"
  // ============================================================
  console.log("\n--- Case 1: Merged '/' Owner Name ---");
  
  let mergedClient = await prisma.client.findFirst({
    where: { email: "merged-owners@test.local" },
  });
  if (!mergedClient) {
    mergedClient = await prisma.client.create({
      data: {
        name: "يوسف شنودة / مريم ماهر",
        phone1: "01001234567",
        nationalId: "29912345678901",
        email: "merged-owners@test.local",
        address1: "123 شارع التحرير، القاهرة",
      },
    });
  }
  console.log(`  Merged client: ${mergedClient.name}`);

  const mergedUnitCode = "GREEN-762";
  let mergedUnit = await prisma.unit.findFirst({ where: { unitCode: mergedUnitCode } });
  if (!mergedUnit) {
    mergedUnit = await prisma.unit.create({
      data: {
        unitCode: mergedUnitCode,
        projectId: project1.id,
        clientId: mergedClient.id,
        agentId: csAgent.id,
        gracePeriod: "Active until Sep 2026",
      },
    });
    await prisma.contractWorkflow.create({
      data: {
        unitId: mergedUnit.id,
        deliveryDate: new Date("2026-06-15"),
        contractDate: new Date("2025-01-10"),
      },
    });
    await prisma.finishing.create({
      data: {
        unitId: mergedUnit.id,
        finishingType: "FULLY_FINISHED",
      },
    });
  }
  console.log(`  Unit: ${mergedUnit.unitCode} (${mergedUnit.id})`);

  // ============================================================
  // CASE 2: LEGACY CLIENT + CO_OWNER VIA unitClients
  // Unit has legacy clientId AND a CO_OWNER added later
  // ============================================================
  console.log("\n--- Case 2: Legacy Client + unitClients CO_OWNER ---");

  let legacyClient = await prisma.client.findFirst({
    where: { email: "legacy-primary@test.local" },
  });
  if (!legacyClient) {
    legacyClient = await prisma.client.create({
      data: {
        name: "محمد أحمد إبراهيم",
        phone1: "01009876543",
        nationalId: "28801234567890",
        email: "legacy-primary@test.local",
        address1: "456 شارع الهرم، الجيزة",
      },
    });
  }

  let addedCoOwner = await prisma.client.findFirst({
    where: { email: "added-coowner@test.local" },
  });
  if (!addedCoOwner) {
    addedCoOwner = await prisma.client.create({
      data: {
        name: "سارة حسن محمود",
        phone1: "01112223333",
        nationalId: "29002345678901",
        email: "added-coowner@test.local",
        address1: "789 شارع النيل، القاهرة",
      },
    });
  }

  const legacyCoOwnerUnitCode = "JURA-5203";
  let legacyCoOwnerUnit = await prisma.unit.findFirst({ where: { unitCode: legacyCoOwnerUnitCode } });
  if (!legacyCoOwnerUnit) {
    legacyCoOwnerUnit = await prisma.unit.create({
      data: {
        unitCode: legacyCoOwnerUnitCode,
        projectId: project2.id,
        clientId: legacyClient.id,
        agentId: csAgent.id,
        gracePeriod: "Active until Nov 2026",
      },
    });
    await prisma.contractWorkflow.create({
      data: {
        unitId: legacyCoOwnerUnit.id,
        deliveryDate: new Date("2026-08-20"),
        contractDate: new Date("2025-03-15"),
      },
    });
    await prisma.finishing.create({
      data: {
        unitId: legacyCoOwnerUnit.id,
        finishingType: "SEMI_FINISHED",
      },
    });
    await prisma.unitClient.create({
      data: {
        unitId: legacyCoOwnerUnit.id,
        clientId: addedCoOwner.id,
        role: "CO_OWNER",
      },
    });
  }
  console.log(`  Primary (legacy): ${legacyClient.name}`);
  console.log(`  Co-Owner (added): ${addedCoOwner.name}`);
  console.log(`  Unit: ${legacyCoOwnerUnit.unitCode} (${legacyCoOwnerUnit.id})`);

  // ============================================================
  // CASE 3: TWO unitClients ROWS, NO LEGACY CLIENT
  // Unit has two unitClients (PRIMARY + CO_OWNER), clientId is null
  // ============================================================
  console.log("\n--- Case 3: Two unitClients, No Legacy Client ---");

  let primaryOnlyOwner = await prisma.client.findFirst({
    where: { email: "uc-primary@test.local" },
  });
  if (!primaryOnlyOwner) {
    primaryOnlyOwner = await prisma.client.create({
      data: {
        name: "سامح إبراهيم محمد معوض",
        phone1: "01223334444",
        nationalId: "27701234567890",
        email: "uc-primary@test.local",
        address1: "321 شارع الأهرام، الجيزة",
      },
    });
  }

  let coOwnerOnly = await prisma.client.findFirst({
    where: { email: "uc-coowner@test.local" },
  });
  if (!coOwnerOnly) {
    coOwnerOnly = await prisma.client.create({
      data: {
        name: "نهى أحمد عبدالرحمن",
        phone1: "01334445555",
        nationalId: "29103456789012",
        email: "uc-coowner@test.local",
        address1: "654 شارع رمسيس، القاهرة",
      },
    });
  }

  const ucOnlyUnitCode = "GENESIS-B5-30";
  let ucOnlyUnit = await prisma.unit.findFirst({ where: { unitCode: ucOnlyUnitCode } });
  if (!ucOnlyUnit) {
    ucOnlyUnit = await prisma.unit.create({
      data: {
        unitCode: ucOnlyUnitCode,
        projectId: project3.id,
        clientId: null,
        agentId: csAgent.id,
        gracePeriod: "Expiring soon - Dec 2026",
      },
    });
    await prisma.contractWorkflow.create({
      data: {
        unitId: ucOnlyUnit.id,
        deliveryDate: new Date("2026-12-01"),
        contractDate: new Date("2025-05-20"),
      },
    });
    await prisma.finishing.create({
      data: {
        unitId: ucOnlyUnit.id,
        finishingType: "CORE_AND_SHELL",
      },
    });
    await prisma.unitClient.create({
      data: {
        unitId: ucOnlyUnit.id,
        clientId: primaryOnlyOwner.id,
        role: "PRIMARY",
        position: 0,
      },
    });
    await prisma.unitClient.create({
      data: {
        unitId: ucOnlyUnit.id,
        clientId: coOwnerOnly.id,
        role: "CO_OWNER",
        position: 1,
      },
    });
  }
  console.log(`  Primary (unitClient): ${primaryOnlyOwner.name}`);
  console.log(`  Co-Owner (unitClient): ${coOwnerOnly.name}`);
  console.log(`  Unit: ${ucOnlyUnit.unitCode} (${ucOnlyUnit.id})`);

  // ============================================================
  // CASE 4: MULTI-UNIT CLIENT WITH SPELLING VARIATIONS
  // Same person owns multiple units but with different name spellings
  // ============================================================
  console.log("\n--- Case 4: Multi-Unit Client with Spelling Variations ---");

  let multiUnit1Client = await prisma.client.findFirst({
    where: { email: "multiunit-var1@test.local" },
  });
  if (!multiUnit1Client) {
    multiUnit1Client = await prisma.client.create({
      data: {
        name: "نصر الله",
        phone1: "01556667777",
        nationalId: "28501234567890",
        email: "multiunit-var1@test.local",
        address1: "111 شارع فيصل، الجيزة",
      },
    });
  }

  let multiUnit2Client = await prisma.client.findFirst({
    where: { email: "multiunit-var2@test.local" },
  });
  if (!multiUnit2Client) {
    multiUnit2Client = await prisma.client.create({
      data: {
        name: "نصرالله",
        phone1: "01556667777",
        email: "multiunit-var2@test.local",
        address1: "111 فيصل، الجيزة",
      },
    });
  }

  const multiVar1UnitCode = "GREEN-801";
  let multiVar1Unit = await prisma.unit.findFirst({ where: { unitCode: multiVar1UnitCode } });
  if (!multiVar1Unit) {
    multiVar1Unit = await prisma.unit.create({
      data: {
        unitCode: multiVar1UnitCode,
        projectId: project1.id,
        clientId: multiUnit1Client.id,
        agentId: csAgent.id,
        gracePeriod: "Active until Jul 2027",
      },
    });
    await prisma.contractWorkflow.create({
      data: {
        unitId: multiVar1Unit.id,
        deliveryDate: new Date("2027-07-01"),
        contractDate: new Date("2025-06-01"),
      },
    });
    await prisma.finishing.create({
      data: {
        unitId: multiVar1Unit.id,
        finishingType: "FULLY_FINISHED",
      },
    });
  }

  const multiVar2UnitCode = "GREEN-802";
  let multiVar2Unit = await prisma.unit.findFirst({ where: { unitCode: multiVar2UnitCode } });
  if (!multiVar2Unit) {
    multiVar2Unit = await prisma.unit.create({
      data: {
        unitCode: multiVar2UnitCode,
        projectId: project1.id,
        clientId: multiUnit2Client.id,
        agentId: csAgent.id,
        gracePeriod: "Active until Jul 2027",
      },
    });
    await prisma.contractWorkflow.create({
      data: {
        unitId: multiVar2Unit.id,
        deliveryDate: new Date("2027-07-15"),
        contractDate: new Date("2025-06-15"),
      },
    });
    await prisma.finishing.create({
      data: {
        unitId: multiVar2Unit.id,
        finishingType: "FULLY_FINISHED",
      },
    });
  }

  console.log(`  Client 1: "${multiUnit1Client.name}" → Unit ${multiVar1Unit.unitCode}`);
  console.log(`  Client 2: "${multiUnit2Client.name}" → Unit ${multiVar2Unit.unitCode}`);
  console.log(`  (Same phone: ${multiUnit1Client.phone1} - should match by phone)`);

  // Create same-person unit with sameحامد إبراهيم for another multi-unit demo
  const samePersonUnitCode = "GENESIS-B5-31";
  let samePersonUnit = await prisma.unit.findFirst({ where: { unitCode: samePersonUnitCode } });
  if (!samePersonUnit) {
    samePersonUnit = await prisma.unit.create({
      data: {
        unitCode: samePersonUnitCode,
        projectId: project3.id,
        clientId: null,
        agentId: csAgent.id,
        gracePeriod: "Active until Mar 2027",
      },
    });
    await prisma.contractWorkflow.create({
      data: {
        unitId: samePersonUnit.id,
        deliveryDate: new Date("2027-03-01"),
        contractDate: new Date("2025-07-01"),
      },
    });
    await prisma.finishing.create({
      data: {
        unitId: samePersonUnit.id,
        finishingType: "SEMI_FINISHED",
      },
    });
    await prisma.unitClient.create({
      data: {
        unitId: samePersonUnit.id,
        clientId: primaryOnlyOwner.id,
        role: "PRIMARY",
        position: 0,
      },
    });
  }
  console.log(`\n  Same person owns B5-30 and B5-31: ${primaryOnlyOwner.name}`);
  console.log(`  Unit 2: ${samePersonUnit.unitCode} (${samePersonUnit.id})`);

  // ============================================================
  // HANDOVER REQUEST FOR EDIT TESTING
  // ============================================================
  console.log("\n--- Handover Request for Edit Testing ---");

  let handoverRequest = await prisma.unitRequest.findFirst({
    where: { unitId: ucOnlyUnit.id, type: "HANDOVER_APPOINTMENT", deletedAt: null },
  });
  if (!handoverRequest) {
    handoverRequest = await prisma.unitRequest.create({
      data: {
        type: "HANDOVER_APPOINTMENT",
        status: "PENDING",
        unitId: ucOnlyUnit.id,
        requestedById: csAgent.id,
        description: "طلب موعد تسليم - يرجى الجدولة للأسبوع القادم",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        currentStepIndex: 0,
        currentApproverKind: "MANAGEMENT",
        submittedAt: new Date(),
      },
    });
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
  console.log(`  Handover request: ${handoverRequest.id}`);

  // ============================================================
  // DELETE FLOW SCENARIO
  // ============================================================
  console.log("\n--- Delete Flow Scenario ---");

  const deleteUnitCode = "DELETE-DEMO-001";
  let deleteUnit = await prisma.unit.findFirst({ where: { unitCode: deleteUnitCode } });
  if (!deleteUnit) {
    const deleteClient = await prisma.client.create({
      data: {
        name: "عميل تجربة الحذف",
        phone1: "01009990000",
        nationalId: `NID-DELETE-${Date.now()}`,
        email: "delete-demo@test.local",
        address1: "شارع الحذف",
      },
    });
    deleteUnit = await prisma.unit.create({
      data: {
        unitCode: deleteUnitCode,
        projectId: project1.id,
        clientId: deleteClient.id,
        agentId: csAgent.id,
        gracePeriod: "N/A",
      },
    });
    await prisma.contractWorkflow.create({
      data: {
        unitId: deleteUnit.id,
        deliveryDate: new Date("2026-05-01"),
        contractDate: new Date("2025-02-01"),
      },
    });
    await prisma.finishing.create({
      data: {
        unitId: deleteUnit.id,
        finishingType: "CORE_AND_SHELL",
      },
    });
  }
  console.log(`  Delete demo unit: ${deleteUnit.unitCode} (${deleteUnit.id})`);

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
        description: "طلب تجريبي للحذف",
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
  console.log(`  Delete demo request: ${deleteRequest.id}`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("=== Seed Complete ===");
  console.log("=".repeat(60));
  console.log("\nTest Users (password: TestPassword1234!):");
  console.log("  Management: demo-mgmt@test.local");
  console.log("  CS Agent:   demo-cs@test.local");
  console.log("\nTest Cases URLs:");
  console.log(`  1. Merged "/" name:        /en/units/${mergedUnit.id}`);
  console.log(`  2. Legacy + CO_OWNER:      /en/units/${legacyCoOwnerUnit.id}`);
  console.log(`  3. Two unitClients:        /en/units/${ucOnlyUnit.id}`);
  console.log(`  4. Multi-unit (var):       /en/units/${multiVar1Unit.id}`);
  console.log(`     Multi-unit (B5-30/31):  /en/units/${ucOnlyUnit.id}`);
  console.log(`  Handover request:          /en/requests/${handoverRequest.id}`);
  console.log(`  Delete demo:               /en/requests/${deleteRequest.id}`);
  console.log("\nUnit IDs for scripts:");
  console.log(`  MERGED_UNIT_ID="${mergedUnit.id}"`);
  console.log(`  LEGACY_COOWNER_UNIT_ID="${legacyCoOwnerUnit.id}"`);
  console.log(`  UC_ONLY_UNIT_ID="${ucOnlyUnit.id}"`);
  console.log(`  MULTI_VAR_UNIT_ID="${multiVar1Unit.id}"`);
  console.log(`  HANDOVER_REQUEST_ID="${handoverRequest.id}"`);
  console.log(`  DELETE_REQUEST_ID="${deleteRequest.id}"`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
