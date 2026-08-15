import "dotenv/config";
import { basePrisma as prisma } from "../lib/prisma";

async function main() {
  const staff = await prisma.user.findMany({
    where: { email: { endsWith: "@newjerseyegypt.com" } },
    select: {
      name: true,
      email: true,
      role: true,
      _count: { select: { assignedUnits: true, tickets: true } },
    },
    orderBy: { name: "asc" },
  });

  const unassignedUnits = await prisma.unit.count({ where: { agentId: null } });
  const unassignedTickets = await prisma.ticket.count({ where: { agentId: null } });

  console.log("\n=== STAFF ASSIGNMENTS ===");
  for (const person of staff) {
    console.log(
      `${person.name.padEnd(16)}  units: ${String(person._count.assignedUnits).padStart(3)}  tickets: ${String(person._count.tickets).padStart(4)}  (${person.role})`
    );
  }
  console.log(`\nUnassigned: ${unassignedUnits} units, ${unassignedTickets} tickets`);
  await prisma.$disconnect();
}

main().catch(console.error);
