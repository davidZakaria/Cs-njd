import "dotenv/config";
import bcrypt from "bcryptjs";
import { basePrisma as prisma } from "../lib/prisma";

async function main() {
  const email = process.env.MANAGEMENT_EMAIL?.trim().toLowerCase();
  const password = process.env.MANAGEMENT_PASSWORD;
  const name = process.env.MANAGEMENT_NAME?.trim() || "Executive User";

  if (!email || !password) {
    console.error(
      "Set MANAGEMENT_EMAIL and MANAGEMENT_PASSWORD in the environment before running."
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("MANAGEMENT_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: passwordHash,
      role: "MANAGEMENT",
      is2FAEnabled: false,
      twoFactorSecret: null,
      requiresPasswordChange: false,
    },
    create: {
      name,
      email,
      password: passwordHash,
      role: "MANAGEMENT",
      is2FAEnabled: false,
      requiresPasswordChange: false,
    },
  });

  console.log("Executive (MANAGEMENT) account ready.");
  console.log(`Email: ${email}`);
  console.log("Access: /executive dashboard, cases, units, users");
  console.log("On first login you will be prompted to set up 2FA.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
