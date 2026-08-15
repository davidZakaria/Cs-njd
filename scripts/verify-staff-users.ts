import { basePrisma as prisma } from "../lib/prisma";

async function main() {
  const staff = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: "@newjerseyegypt.com" } },
        { email: { endsWith: "@imported.njd.local" } },
        { email: { endsWith: "@njd.local" } },
      ],
    },
    select: {
      name: true,
      email: true,
      role: true,
      _count: { select: { assignedUnits: true, tickets: true } },
    },
    orderBy: { name: "asc" },
  });

  console.table(
    staff.map((u) => ({
      name: u.name,
      email: u.email,
      role: u.role,
      units: u._count.assignedUnits,
      tickets: u._count.tickets,
    }))
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
