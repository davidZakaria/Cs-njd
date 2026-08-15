import { basePrisma } from "../lib/prisma";

async function main() {
  const emails = [
    "madonna.hanna@newjerseyegypt.com",
    "manager@njd.local",
  ];

  for (const email of emails) {
    const user = await basePrisma.user.findFirst({ where: { email } });
    if (!user) {
      console.log(email, "not found");
      continue;
    }
    const eitherMine = await basePrisma.ticket.count({
      where: {
        OR: [{ agentId: user.id }, { unit: { agentId: user.id } }],
      },
    });
    console.log(user.name, user.role, { assignedCases: eitherMine });
  }
}

main()
  .catch(console.error)
  .finally(() => basePrisma.$disconnect());
