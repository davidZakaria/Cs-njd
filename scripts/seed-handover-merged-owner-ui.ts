/**
 * Seeds a GREEN AVENUE unit with merged "/" owner name for handover UI screenshots.
 * Run: npx tsx scripts/seed-handover-merged-owner-ui.ts
 */
import "dotenv/config";
import { PrismaClient, Role, UnitClientRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD_HASH = bcrypt.hashSync("TestPassword1234!", 10);
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

async function main() {
  const project =
    (await prisma.project.findFirst({ where: { name: "GREEN AVENUE" } })) ??
    (await prisma.project.create({
      data: { name: "GREEN AVENUE", unitCycleEnabled: true },
    }));
  if (!project.unitCycleEnabled) {
    await prisma.project.update({
      where: { id: project.id },
      data: { unitCycleEnabled: true },
    });
  }

  const user =
    (await prisma.user.findUnique({ where: { email: "demo-mgmt@test.local" } })) ??
    (await prisma.user.create({
      data: {
        email: "demo-mgmt@test.local",
        name: "Demo Manager",
        role: Role.MANAGEMENT,
        password: PASSWORD_HASH,
        is2FAEnabled: true,
        twoFactorSecret: TOTP_SECRET,
        requiresPasswordChange: false,
      },
    }));

  const primaryName = "يوسف شنودة / مريم ماهر";
  let client = await prisma.client.findFirst({
    where: { email: "handover-merged-ui@test.local" },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: primaryName,
        nationalId: "29912345678901",
        phone1: "01001234567",
        email: "handover-merged-ui@test.local",
        address1: "123 شارع التحرير، القاهرة",
      },
    });
  }

  const unitCode = "GA-HANDOVER-MERGED-DEMO";
  let unit = await prisma.unit.findFirst({ where: { unitCode } });
  if (!unit) {
    unit = await prisma.unit.create({
      data: {
        unitCode,
        projectId: project.id,
        clientId: client.id,
        area: 145,
        gracePeriod: "Active until Sep 2026",
        contractWorkflow: {
          create: {
            contractDate: new Date("2025-01-10"),
            deliveryDate: new Date("2026-06-15"),
          },
        },
        finishing: {
          create: {
            finishingType: "FULLY_FINISHED",
          },
        },
      },
    });
  }

  const primaryLink = await prisma.unitClient.findFirst({
    where: { unitId: unit.id, clientId: client.id },
  });
  if (!primaryLink) {
    await prisma.unitClient.create({
      data: {
        unitId: unit.id,
        clientId: client.id,
        role: UnitClientRole.PRIMARY,
        position: 0,
      },
    });
  }

  console.log(JSON.stringify({ unitId: unit.id, userEmail: user.email }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());