import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { CANONICAL_PROJECTS } from "../lib/projects";

const prisma = new PrismaClient();

async function main() {
  for (const name of CANONICAL_PROJECTS) {
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
