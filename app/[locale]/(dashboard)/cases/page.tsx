import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { getAssignableAgentEmails } from "@/lib/staff";
import { splitCasesForManager, getEffectiveCaseAgent } from "@/lib/cases/ownership";
import { CasesTable, type CaseRow } from "@/components/cases/cases-table";

export default async function CasesPage() {
  const session = await auth();
  const t = await getTranslations("cases");
  const isManager = session?.user.role === "MANAGEMENT";

  const ticketWhere =
    session?.user.role === "CS_AGENT"
      ? {
          OR: [
            { agentId: session.user.id },
            { unit: { agentId: session.user.id } },
          ],
        }
      : {};

  const [tickets, agents] = await Promise.all([
    prisma.ticket.findMany({
      where: ticketWhere,
      include: {
        agent: true,
        unit: {
          include: {
            project: true,
            client: true,
            agent: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { email: { in: getAssignableAgentEmails() } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: CaseRow[] = tickets.map((ticket) => {
    const effective = getEffectiveCaseAgent(
      ticket.agentId,
      ticket.agent?.name,
      ticket.unit.agentId,
      ticket.unit.agent?.name
    );

    return {
      id: ticket.id,
      notes: ticket.notes,
      category: ticket.category,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      unitId: ticket.unitId,
      unitCode: ticket.unit.unitCode,
      project: ticket.unit.project.name,
      client: ticket.unit.client?.name ?? "-",
      agentId: ticket.agentId,
      unitAgentId: ticket.unit.agentId,
      agent: ticket.agent?.name ?? "",
      effectiveAgentId: effective.id,
      effectiveAgent: effective.name,
    };
  });

  const canAssign =
    session?.user.role === "SUPER_ADMIN" || session?.user.role === "MANAGEMENT";

  if (isManager && session?.user.id) {
    const { mine, team } = splitCasesForManager(rows, session.user.id);

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("manager.pageSubtitle")}</p>
        </div>
        <CasesTable
          data={team}
          agents={agents}
          canAssign={true}
          defaultStatusFilter="open"
          sectionTitle={t("manager.teamCases.title", { count: team.length })}
          sectionDescription={t("manager.teamCases.subtitle")}
        />
        <CasesTable
          data={mine}
          agents={agents}
          canAssign={false}
          defaultCollapsed={true}
          sectionTitle={t("manager.myCases.title", { count: mine.length })}
          sectionDescription={t("manager.myCases.subtitle")}
        />
      </div>
    );
  }

  const isCsAgent = session?.user.role === "CS_AGENT";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <CasesTable
        data={rows}
        agents={agents}
        canAssign={canAssign}
        sectionTitle={
          isCsAgent
            ? t("assignedToMe.title", { count: rows.length })
            : undefined
        }
        sectionDescription={isCsAgent ? t("assignedToMe.subtitle") : undefined}
      />
    </div>
  );
}
