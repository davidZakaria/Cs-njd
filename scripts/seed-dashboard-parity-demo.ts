/**
 * Minimal fake units/cases for dashboard parity screenshots (no production data).
 */
import { prisma } from "@/lib/prisma";

export async function seedDashboardParityDemo() {
  const project =
    (await prisma.project.findFirst({ where: { name: "Dashboard Parity Demo" } })) ??
    (await prisma.project.create({
      data: { name: "Dashboard Parity Demo" },
    }));

  const unitCodes = ["DP-LEGAL-1", "DP-LEGAL-2", "DP-DEL-1"];
  for (const code of unitCodes) {
    const existing = await prisma.unit.findFirst({
      where: { projectId: project.id, unitCode: code },
    });
    if (existing) continue;
    await prisma.unit.create({
      data: {
        projectId: project.id,
        unitCode: code,
        type: "APARTMENT",
        area: 100,
        contractWorkflow: {
          create: {
            handoverStatus:
              code.startsWith("DP-LEGAL") ? "DELIVERY_WARNING" : "DELIVERED",
          },
        },
      },
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDashboardParityDemo()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}