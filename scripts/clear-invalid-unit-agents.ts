import { basePrisma as prisma } from "../lib/prisma";
import {
  getAssignableAgentUsers,
  isValidUnitAgentId,
} from "../lib/units/assignable-agents";

async function main() {
  const assignableAgents = await getAssignableAgentUsers();
  const validIds = new Set(assignableAgents.map((agent) => agent.id));

  const units = await prisma.unit.findMany({
    where: { agentId: { not: null } },
    select: { id: true, unitCode: true, agentId: true, project: { select: { name: true } } },
  });

  const invalid = units.filter(
    (unit) => unit.agentId != null && !validIds.has(unit.agentId)
  );

  console.log(
    `Found ${invalid.length} unit(s) with non-roster agent IDs (${units.length} assigned total).`
  );

  if (invalid.length === 0) return;

  for (const unit of invalid) {
    await prisma.unit.update({
      where: { id: unit.id },
      data: { agentId: null },
    });
    console.log(
      `Cleared ${unit.project.name} · ${unit.unitCode} (was ${unit.agentId})`
    );
  }

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
