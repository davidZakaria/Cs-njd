import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activeTicketWhere, activeUnitWhere } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { getAssignableAgentEmails } from "@/lib/staff";
import { UnitsTable } from "@/components/units/units-table";

export default async function UnitsPage() {
  const session = await auth();
  const t = await getTranslations("units");

  const scope =
    session?.user.role === "CS_AGENT" ? { agentId: session.user.id } : {};

  const [units, staffUsers] = await Promise.all([
    prisma.unit.findMany({
      where: activeUnitWhere(scope),
      include: {
        project: true,
        client: true,
        agent: true,
        contractWorkflow: true,
      },
      orderBy: [{ project: { name: "asc" } }, { unitCode: "asc" }],
    }),
    prisma.user.findMany({
      where: { email: { in: getAssignableAgentEmails() } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  const rows = units.map((unit) => ({
    id: unit.id,
    unitCode: unit.unitCode,
    project: unit.project.name,
    client: unit.client?.name ?? "-",
    type: unit.type,
    area: unit.area,
    agent: unit.agent?.name ?? "-",
    handoverStatus: unit.contractWorkflow?.handoverStatus ?? "PENDING",
  }));

  const projects = [...new Set(rows.map((r) => r.project))].sort();
  const agents = staffUsers.map((user) => user.name);
  const statuses = [...new Set(rows.map((r) => r.handoverStatus))].sort();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <UnitsTable data={rows} projects={projects} agents={agents} statuses={statuses} />
    </div>
  );
}
