import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROJECTS = ["GREEN AVENUE", "JURA", "GENESIS", "SOUL PLAZA"] as const;

async function main() {
  for (const name of PROJECTS) {
    await prisma.project.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("Seed completed (projects only).");
  console.log(
    "Create the super admin: npm run db:bootstrap-admin (see .env.example)"
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
