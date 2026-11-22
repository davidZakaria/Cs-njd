/**
 * Seed script to test handover request editing with a unit that has two owners.
 * Run with: npx tsx scripts/seed-two-owner-handover-test.ts
 */
import "dotenv/config";
import { PrismaClient, UnitRequestType, UnitClientRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Setting up two-owner handover test scenario...\n");

  // Find or create a project
  let project = await prisma.project.findFirst({ where: { name: "Green Avenue" } });
  if (!project) {
    project = await prisma.project.create({
      data: { name: "Green Avenue" },
    });
  }
  console.log(`Using project: ${project.name} (${project.id})`);

  // Find or create a test user (management)
  let testUser = await prisma.user.findFirst({
    where: { email: "test-mgmt@njd.local" },
  });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: "test-mgmt@njd.local",
        name: "Test Manager",
        password: "dummy-password-hash",
        role: "MANAGEMENT",
        is2FAEnabled: false,
        requiresPasswordChange: false,
      },
    });
  }
  console.log(`Using test user: ${testUser.name} (${testUser.id})`);

  // Create primary owner client
  const primaryClient = await prisma.client.create({
    data: {
      name: "Ahmed Ibrahim (Primary)",
      phone1: "01001234567",
      nationalId: `NID-PRIMARY-${Date.now()}`,
      email: "ahmed.primary@test.local",
      address1: "123 Main St, Cairo",
    },
  });
  console.log(`Created primary client: ${primaryClient.name} (${primaryClient.id})`);

  // Create co-owner client
  const coOwnerClient = await prisma.client.create({
    data: {
      name: "Sara Ahmed (Co-owner)",
      phone1: "01009876543",
      nationalId: `NID-COOWNER-${Date.now()}`,
      email: "sara.coowner@test.local",
      address1: "456 Second St, Giza",
    },
  });
  console.log(`Created co-owner client: ${coOwnerClient.name} (${coOwnerClient.id})`);

  // Create unit with two owners
  const unitCode = `TEST-${Date.now().toString(36).toUpperCase()}`;
  const unit = await prisma.unit.create({
    data: {
      unitCode,
      projectId: project.id,
      clientId: primaryClient.id,
      type: "APARTMENT",
      area: 150,
      deliveryYear: "2027",
      gracePeriod: "12 months",
      contractWorkflow: {
        create: {
          handoverStatus: "PENDING",
          contractDate: new Date("2026-01-15"),
          deliveryDate: new Date("2027-06-30"),
        },
      },
      finishing: {
        create: {
          finishingType: "FULLY_FINISHED",
        },
      },
    },
  });
  console.log(`Created unit: ${unit.unitCode} (${unit.id})`);

  // Create UnitClient links for both owners
  await prisma.unitClient.create({
    data: {
      unitId: unit.id,
      clientId: primaryClient.id,
      role: UnitClientRole.PRIMARY,
      position: 0,
    },
  });
  console.log("Created PRIMARY owner link");

  await prisma.unitClient.create({
    data: {
      unitId: unit.id,
      clientId: coOwnerClient.id,
      role: UnitClientRole.CO_OWNER,
      position: 1,
    },
  });
  console.log("Created CO_OWNER link");

  // Create a handover appointment request
  const request = await prisma.unitRequest.create({
    data: {
      type: UnitRequestType.HANDOVER_APPOINTMENT,
      unitId: unit.id,
      clientId: primaryClient.id,
      requestedById: testUser.id,
      status: "DRAFT",
      description: "Initial handover appointment request for two-owner unit",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`Created handover request: ${request.id}`);

  // Create an audit event
  await prisma.requestAuditEvent.create({
    data: {
      requestId: request.id,
      userId: testUser.id,
      action: "created",
      details: { type: request.type },
    },
  });
  console.log("Created audit event");

  // Add an attachment to the request
  await prisma.requestAttachment.create({
    data: {
      requestId: request.id,
      storedName: `test-attachment-${Date.now()}.pdf`,
      originalName: "handover-document.pdf",
      mimeType: "application/pdf",
      sizeBytes: 12345,
      uploadedById: testUser.id,
    },
  });
  console.log("Created test attachment");

  console.log("\n--- Test Data Summary ---");
  console.log(`Unit ID: ${unit.id}`);
  console.log(`Unit Code: ${unit.unitCode}`);
  console.log(`Project: ${project.name}`);
  console.log(`Primary Client: ${primaryClient.name}`);
  console.log(`Co-Owner Client: ${coOwnerClient.name}`);
  console.log(`Request ID: ${request.id}`);
  console.log(`Request Type: ${request.type}`);

  // Now test loading the request with full context
  console.log("\n--- Testing Request Load ---");
  
  const loadedRequest = await prisma.unitRequest.findUnique({
    where: { id: request.id },
    include: {
      unit: {
        include: {
          project: true,
          client: true,
          unitClients: {
            orderBy: [{ role: "asc" }, { position: "asc" }],
            include: {
              client: true,
            },
          },
        },
      },
      requestedBy: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
      attachments: {
        where: { removedAt: null },
        orderBy: { createdAt: "asc" },
      },
      auditEvents: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (loadedRequest?.unit) {
    console.log(`Unit loaded: ${loadedRequest.unit.unitCode}`);
    console.log(`Client on unit: ${loadedRequest.unit.client?.name ?? "None"}`);
    console.log(`UnitClients count: ${loadedRequest.unit.unitClients.length}`);
    for (const link of loadedRequest.unit.unitClients) {
      console.log(`  - ${link.role}: ${link.client.name}`);
    }
  }

  console.log(`\nAttachments: ${loadedRequest?.attachments.length ?? 0}`);
  console.log(`Audit events: ${loadedRequest?.auditEvents.length ?? 0}`);

  console.log("\n✅ Two-owner handover test data seeded successfully!");
  console.log(`\nTo test in the UI, navigate to:`);
  console.log(`  /en/units/${unit.id}`);
  console.log(`  /en/requests/${request.id}`);
}

main()
  .catch((e) => {
    console.error("Error seeding test data:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
