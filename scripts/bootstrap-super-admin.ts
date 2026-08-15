import "dotenv/config";
import bcrypt from "bcryptjs";
import { basePrisma as prisma } from "../lib/prisma";

const PROJECTS = ["GREEN AVENUE", "JURA", "GENESIS", "SOUL PLAZA"] as const;

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

  if (!email || !password) {
    console.error(
      "Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env before running."
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("SUPER_ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: passwordHash,
      role: "SUPER_ADMIN",
      is2FAEnabled: false,
      twoFactorSecret: null,
      requiresPasswordChange: false,
    },
    create: {
      name,
      email,
      password: passwordHash,
      role: "SUPER_ADMIN",
      is2FAEnabled: false,
      requiresPasswordChange: false,
    },
  });

  for (const projectName of PROJECTS) {
    await prisma.project.upsert({
      where: { name: projectName },
      update: {},
      create: { name: projectName },
    });
  }

  console.log("Bootstrap complete.");
  console.log(`Super admin: ${email}`);
  console.log("Projects seeded:", PROJECTS.join(", "));
  console.log(
    "Add staff later: npm run db:sync-staff (or create users in /users)"
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
