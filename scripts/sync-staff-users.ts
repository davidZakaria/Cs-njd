import bcrypt from "bcryptjs";
import { basePrisma as prisma } from "../lib/prisma";
import { STAFF_DEFAULT_PASSWORD, STAFF_ROSTER } from "../lib/staff";

async function main() {
  const passwordHash = await bcrypt.hash(STAFF_DEFAULT_PASSWORD, 12);

  for (const person of STAFF_ROSTER) {
    const byEmail = await prisma.user.findUnique({
      where: { email: person.email.toLowerCase() },
    });

    let user =
      byEmail ??
      (await prisma.user.findFirst({
        where: {
          OR: person.legacyNames.map((name) => ({ name })),
        },
      }));

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: person.name,
          email: person.email.toLowerCase(),
          role: person.role,
          password: passwordHash,
          is2FAEnabled: false,
          twoFactorSecret: null,
          requiresPasswordChange: true,
        },
      });
      console.log(`Updated: ${person.name} (${person.email})`);
    } else {
      user = await prisma.user.create({
        data: {
          name: person.name,
          email: person.email.toLowerCase(),
          password: passwordHash,
          role: person.role,
          is2FAEnabled: false,
          requiresPasswordChange: true,
        },
      });
      console.log(`Created: ${person.name} (${person.email})`);
    }

    for (const legacyName of person.legacyNames) {
      const legacyUsers = await prisma.user.findMany({
        where: {
          name: legacyName,
          id: { not: user.id },
        },
      });

      for (const legacy of legacyUsers) {
        await prisma.unit.updateMany({
          where: { agentId: legacy.id },
          data: { agentId: user.id },
        });
        await prisma.ticket.updateMany({
          where: { agentId: legacy.id },
          data: { agentId: user.id },
        });
        await prisma.user.delete({ where: { id: legacy.id } });
        console.log(`  Merged legacy user "${legacyName}" -> ${person.email}`);
      }
    }
  }

  console.log("\nStaff sync complete. Default password:", STAFF_DEFAULT_PASSWORD);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
