import { buildStaffAliasMap, getCsAgentEmails, normalizeAgentKey } from "../lib/staff";
import { basePrisma as prisma } from "../lib/prisma";

async function main() {
  const aliasToEmail = buildStaffAliasMap();
  const staffIds = new Map(
    (
      await prisma.user.findMany({
        where: { email: { in: getCsAgentEmails() } },
        select: { id: true, email: true },
      })
    ).map((user) => [user.email.toLowerCase(), user.id])
  );

  const imported = await prisma.user.findMany({
    where: { email: { endsWith: "@imported.njd.local" } },
    select: { id: true, name: true, email: true },
  });

  console.log(`Removing ${imported.length} imported placeholder users...`);

  for (const user of imported) {
    const mappedEmail = aliasToEmail.get(normalizeAgentKey(user.name));
    const replacementId = mappedEmail
      ? staffIds.get(mappedEmail.toLowerCase()) ?? null
      : null;

    if (replacementId) {
      await prisma.unit.updateMany({
        where: { agentId: user.id },
        data: { agentId: replacementId },
      });
      await prisma.ticket.updateMany({
        where: { agentId: user.id },
        data: { agentId: replacementId },
      });
    } else {
      await prisma.unit.updateMany({
        where: { agentId: user.id },
        data: { agentId: null },
      });
      await prisma.ticket.updateMany({
        where: { agentId: user.id },
        data: { agentId: null },
      });
    }

    await prisma.user.delete({ where: { id: user.id } });
    console.log(`Removed: ${user.name}`);
  }

  console.log("Done. Only roster staff remain for assignment.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
