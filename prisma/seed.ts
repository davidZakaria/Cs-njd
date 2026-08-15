import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { STAFF_DEFAULT_PASSWORD, STAFF_ROSTER } from "../lib/staff";
const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash(STAFF_DEFAULT_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: "admin@njd.local" },
    update: {},
    create: {
      name: "Super Admin",
      email: "admin@njd.local",
      password,
      role: "SUPER_ADMIN",
      is2FAEnabled: false,
      requiresPasswordChange: false,
    },
  });

  await prisma.user.upsert({
    where: { email: "manager@njd.local" },
    update: {},
    create: {
      name: "Management User",
      email: "manager@njd.local",
      password,
      role: "MANAGEMENT",
      is2FAEnabled: false,
      requiresPasswordChange: true,
    },
  });

  for (const person of STAFF_ROSTER) {
    await prisma.user.upsert({
      where: { email: person.email },
      update: { name: person.name, role: person.role },
      create: {
        name: person.name,
        email: person.email,
        password,
        role: person.role,
        is2FAEnabled: false,
        requiresPasswordChange: true,
      },
    });
  }

  const projects = ["GREEN AVENUE", "JURA", "GENESIS", "SOUL PLAZA"];
  for (const name of projects) {
    await prisma.project.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("Seed completed.");
  console.log("Admin: admin@njd.local / ChangeMe123!");
  console.log("Executive (MANAGEMENT): madonna.hanna@newjerseyegypt.com, reda.youssef@newjerseyegypt.com /", STAFF_DEFAULT_PASSWORD);
  console.log("Staff emails use password:", STAFF_DEFAULT_PASSWORD);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
