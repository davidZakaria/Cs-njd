/**
 * Fake users for 2FA reset bypass walkthrough screenshots (do not use in production).
 */
import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const USERS = {
  staleAgent: {
    email: "2fa-stale-agent@test.local",
    password: "Walkthrough123!",
    name: "Stale Approval Agent",
    totpSecret: "JBSWY3DPEHPK3PXP",
  },
  pendingAgent: {
    email: "2fa-pending-agent@test.local",
    password: "Walkthrough123!",
    name: "Pending Reset Agent",
    totpSecret: "JBSWY3DPEHPK3PXP",
  },
  freshAgent: {
    email: "2fa-fresh-agent@test.local",
    password: "Walkthrough123!",
    name: "Fresh Approval Agent",
    totpSecret: "JBSWY3DPEHPK3PXP",
  },
  approvedForSetup: {
    email: "2fa-approved-setup@test.local",
    password: "Walkthrough123!",
    name: "Approved Setup Agent",
    totpSecret: "JBSWY3DPEHPK3PXP",
  },
  superAdmin: {
    email: "2fa-walk-super@test.local",
    password: "Walkthrough123!",
    name: "Walkthrough Super Admin",
    totpSecret: "JBSWY3DPEHPK3PXP",
  },
} as const;

async function upsertUser(
  spec: (typeof USERS)[keyof typeof USERS],
  role: "CS_AGENT" | "SUPER_ADMIN",
  data: {
    is2FAEnabled: boolean;
    twoFactorSecret: string | null;
    requiresPasswordChange?: boolean;
  }
) {
  const passwordHash = await bcrypt.hash(spec.password, 10);
  return prisma.user.upsert({
    where: { email: spec.email },
    create: {
      email: spec.email,
      name: spec.name,
      password: passwordHash,
      role,
      isActive: true,
      requiresPasswordChange: data.requiresPasswordChange ?? false,
      is2FAEnabled: data.is2FAEnabled,
      twoFactorSecret: data.twoFactorSecret,
    },
    update: {
      name: spec.name,
      password: passwordHash,
      role,
      isActive: true,
      requiresPasswordChange: data.requiresPasswordChange ?? false,
      is2FAEnabled: data.is2FAEnabled,
      twoFactorSecret: data.twoFactorSecret,
    },
  });
}

async function main() {
  const [stale, pending, fresh, approvedForSetup, superAdmin] = await Promise.all([
    upsertUser(USERS.staleAgent, "CS_AGENT", {
      is2FAEnabled: true,
      twoFactorSecret: USERS.staleAgent.totpSecret,
    }),
    upsertUser(USERS.pendingAgent, "CS_AGENT", {
      is2FAEnabled: true,
      twoFactorSecret: USERS.pendingAgent.totpSecret,
    }),
    upsertUser(USERS.freshAgent, "CS_AGENT", {
      is2FAEnabled: false,
      twoFactorSecret: "PENDINGSECRETNOTSET",
    }),
    upsertUser(USERS.approvedForSetup, "CS_AGENT", {
      is2FAEnabled: false,
      twoFactorSecret: null,
    }),
    upsertUser(USERS.superAdmin, "SUPER_ADMIN", {
      is2FAEnabled: true,
      twoFactorSecret: USERS.superAdmin.totpSecret,
    }),
  ]);

  await prisma.twoFactorResetRequest.deleteMany({
    where: { userId: { in: [stale.id, pending.id, fresh.id, approvedForSetup.id] } },
  });

  await prisma.twoFactorResetRequest.create({
    data: {
      userId: stale.id,
      status: "APPROVED",
      reviewedAt: new Date("2025-06-01T12:00:00Z"),
      reviewedById: superAdmin.id,
      usedAt: null,
    },
  });

  await prisma.twoFactorResetRequest.create({
    data: {
      userId: pending.id,
      status: "PENDING",
      requestedAt: new Date(),
    },
  });

  await prisma.twoFactorResetRequest.create({
    data: {
      userId: approvedForSetup.id,
      status: "APPROVED",
      reviewedAt: new Date("2025-11-24T10:00:00Z"),
      reviewedById: superAdmin.id,
      usedAt: null,
    },
  });

  await prisma.user.update({
    where: { id: approvedForSetup.id },
    data: {
      is2FAEnabled: false,
      twoFactorSecret: "WALKTHROUGH_PENDING_SECRET",
    },
  });

  const consumed = await prisma.twoFactorResetRequest.create({
    data: {
      userId: fresh.id,
      status: "APPROVED",
      reviewedAt: new Date("2025-11-20T10:00:00Z"),
      reviewedById: superAdmin.id,
      usedAt: new Date("2025-11-20T10:30:00Z"),
    },
  });

  console.log("2FA walkthrough seed ready:");
  console.log("  stale agent:", USERS.staleAgent.email);
  console.log("  pending agent:", USERS.pendingAgent.email);
  console.log("  fresh agent:", USERS.freshAgent.email);
  console.log("  super admin:", USERS.superAdmin.email);
  console.log("  consumed request:", consumed.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());