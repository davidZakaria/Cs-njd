import { basePrisma } from "../lib/prisma";

async function main() {
  const users = await basePrisma.user.findMany({
    where: { email: { endsWith: "@imported.njd.local" } },
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { tickets: true, assignedUnits: true } },
    },
    orderBy: { name: "asc" },
  });

  console.log("imported users:", users.length);
  console.log("long names (>50):", users.filter((u) => u.name.length > 50).length);
  console.log(
    "samples long:",
    users
      .filter((u) => u.name.length > 50)
      .slice(0, 3)
      .map((u) => ({
        name: u.name.slice(0, 80),
        tickets: u._count.tickets,
        units: u._count.assignedUnits,
      }))
  );
  console.log(
    "real agents:",
    users.filter((u) => u.name.length <= 30).map((u) => u.name)
  );
}

main()
  .catch(console.error)
  .finally(() => basePrisma.$disconnect());
