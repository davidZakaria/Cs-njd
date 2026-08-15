import { isLikelyAgentName } from "../lib/import/columns";
import { basePrisma as prisma } from "../lib/prisma";

async function main() {
  const imported = await prisma.user.findMany({
    where: { email: { endsWith: "@imported.njd.local" } },
    select: { id: true, name: true, email: true },
  });

  const bogus = imported.filter((user) => !isLikelyAgentName(user.name));
  console.log(`Found ${bogus.length} bogus imported users to remove.`);

  for (const user of bogus) {
    await prisma.unit.updateMany({
      where: { agentId: user.id },
      data: { agentId: null },
    });
    await prisma.ticket.updateMany({
      where: { agentId: user.id },
      data: { agentId: null },
    });
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`Removed: ${user.name.slice(0, 60)}...`);
  }

  console.log("Cleanup complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
