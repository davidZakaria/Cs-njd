/**
 * Fake call-log inbox fixtures for walkthrough screenshots.
 */
import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

import { dispatchCallLogActivity } from "../lib/notifications/dispatch-activity-notifications";

const prisma = new PrismaClient();
const TEST_PASSWORD = "TestPassword1234!";
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

async function ensureUser(email: string, name: string, role: Role) {
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
  const csAgent = await ensureUser("demo-cs@test.local", "Demo CS Agent", "CS_AGENT");
  const manager = await ensureUser("demo-mgmt@test.local", "Demo Manager", "MANAGEMENT");
  const community = await ensureUser(
    "demo-community@test.local",
    "Demo Community",
    "COMMUNITY_MANAGEMENT"
  );

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

  async function ensureUnit(unitCode: string, agentId: string | null) {
    let unit = await prisma.unit.findFirst({ where: { unitCode } });
    if (!unit) {
      unit = await prisma.unit.create({
        data: { unitCode, projectId: project.id, clientId: client.id, agentId },
      });
    } else {
      unit = await prisma.unit.update({
        where: { id: unit.id },
        data: { agentId },
      });
    }
    return unit;
  }

  const unitAssigned = await ensureUnit("CALLLOG-SEEN", csAgent.id);
  const unitPending = await ensureUnit("CALLLOG-PENDING", csAgent.id);
  const unitNoAgent = await ensureUnit("CALLLOG-NOAGENT", null);

  await prisma.notification.deleteMany({
    where: { inboxTab: "CALL_LOG" },
  });

  const unitContext = (unit: typeof unitAssigned) => ({
    id: unit.id,
    unitCode: unit.unitCode,
    agentId: unit.agentId,
    projectId: project.id,
    project: { id: project.id, name: project.name },
    client: { name: client.name },
  });

  const ticketSeen = await prisma.ticket.create({
    data: {
      unitId: unitAssigned.id,
      notes: "📞 Client confirmed visit — seen demo",
      category: "FEEDBACK_HISTORY",
      status: "PENDING",
      agentId: community.id,
      createdById: community.id,
      pendingParty: "NONE",
    },
  });

  await dispatchCallLogActivity({
    actorUserId: community.id,
    actorName: community.name ?? "Demo Community",
    unit: unitContext(unitAssigned),
    notes: ticketSeen.notes,
    ticketId: ticketSeen.id,
  });

  const seenAt = new Date("2026-11-22T14:30:00.000Z");
  await prisma.notification.updateMany({
    where: {
      userId: csAgent.id,
      dedupeKey: `call-log:${ticketSeen.id}`,
    },
    data: { isRead: true, readAt: seenAt },
  });

  const ticketPending = await prisma.ticket.create({
    data: {
      unitId: unitPending.id,
      notes: "📞 Not opened by CS yet — pending demo",
      category: "FEEDBACK_HISTORY",
      status: "PENDING",
      agentId: community.id,
      createdById: community.id,
      pendingParty: "NONE",
    },
  });

  await dispatchCallLogActivity({
    actorUserId: community.id,
    actorName: community.name ?? "Demo Community",
    unit: unitContext(unitPending),
    notes: ticketPending.notes,
    ticketId: ticketPending.id,
  });

  const ticketNoAgent = await prisma.ticket.create({
    data: {
      unitId: unitNoAgent.id,
      notes: "📞 Unit with no CS assignee",
      category: "FEEDBACK_HISTORY",
      status: "PENDING",
      agentId: community.id,
      createdById: community.id,
      pendingParty: "NONE",
    },
  });

  await dispatchCallLogActivity({
    actorUserId: community.id,
    actorName: community.name ?? "Demo Community",
    unit: unitContext(unitNoAgent),
    notes: ticketNoAgent.notes,
    ticketId: ticketNoAgent.id,
  });

  console.log("Call log walkthrough seed complete");
  console.log(`Manager: demo-mgmt@test.local / ${TEST_PASSWORD}`);
  console.log(`CS agent: demo-cs@test.local / ${TEST_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());