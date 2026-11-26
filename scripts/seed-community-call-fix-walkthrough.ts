/**
 * Fake data for community call-log counter + inbox walkthrough screenshots.
 */
import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

import { dispatchCallLogActivity } from "../lib/notifications/dispatch-activity-notifications";
import { normalizeCallLogNotesForStorage } from "../lib/calls/call-log-notes";

const prisma = new PrismaClient();
const TEST_PASSWORD = "TestPassword1234!";
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const DEMO_EMAIL = "demo-community@test.local";

async function ensureUser(email: string, name: string, role: Role) {
  return prisma.user.upsert({
    where: { email },
    update: {
      password: PASSWORD_HASH,
      name,
      role,
      is2FAEnabled: true,
      twoFactorSecret: TOTP_SECRET,
      requiresPasswordChange: false,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email,
      name,
      password: PASSWORD_HASH,
      role,
      is2FAEnabled: true,
      twoFactorSecret: TOTP_SECRET,
      requiresPasswordChange: false,
      isActive: true,
    },
  });
}

async function main() {
  const csAgent = await ensureUser(
    "demo-cs@test.local",
    "Demo CS Agent",
    "CS_AGENT"
  );
  const community = await ensureUser(DEMO_EMAIL, "Nardine Community", "COMMUNITY_MANAGEMENT");

  const project =
    (await prisma.project.findFirst({ where: { name: "Walkthrough Call Logs" } })) ??
    (await prisma.project.create({ data: { name: "Walkthrough Call Logs" } }));

  const client =
    (await prisma.client.findFirst({ where: { phone1: "01000009999" } })) ??
    (await prisma.client.create({
      data: {
        name: "Walkthrough Client",
        phone1: "01000009999",
        nationalId: "29901112223300",
      },
    }));

  let unit = await prisma.unit.findFirst({ where: { unitCode: "5C05" } });
  if (!unit) {
    unit = await prisma.unit.create({
      data: {
        unitCode: "5C05",
        projectId: project.id,
        clientId: client.id,
        agentId: csAgent.id,
      },
    });
  } else {
    unit = await prisma.unit.update({
      where: { id: unit.id },
      data: { agentId: csAgent.id, clientId: client.id },
    });
  }

  const todayStart = new Date();
  todayStart.setHours(12, 0, 0, 0);

  const arabicNotes = normalizeCallLogNotesForStorage(
    "عند الاتصال مع العميلة — تأكيد الموعد"
  );

  await prisma.notification.deleteMany({
    where: { userId: community.id, inboxTab: "CALL_LOG" },
  });

  await prisma.ticket.deleteMany({
    where: {
      unitId: unit.id,
      createdById: community.id,
      notes: { contains: "عند الاتصال مع العميلة" },
    },
  });

  const ticket = await prisma.ticket.create({
    data: {
      unitId: unit.id,
      notes: arabicNotes,
      category: "FEEDBACK_HISTORY",
      status: "PENDING",
      agentId: community.id,
      createdById: community.id,
      pendingParty: "NONE",
      createdAt: todayStart,
    },
  });

  const unitContext = {
    id: unit.id,
    unitCode: unit.unitCode,
    agentId: unit.agentId,
    projectId: project.id,
    project: { id: project.id, name: project.name },
    client: { name: client.name },
  };

  await dispatchCallLogActivity({
    actorUserId: community.id,
    actorName: community.name ?? "Nardine Community",
    unit: unitContext,
    notes: arabicNotes,
    ticketId: ticket.id,
  });

  console.log("Community call-fix walkthrough seed complete");
  console.log(`Community user: ${DEMO_EMAIL} / ${TEST_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());