import { auth } from "@/lib/auth";
import { resolveCsAgentScope } from "@/lib/auth/cs-agent-scope";
import { prisma } from "@/lib/prisma";
import { activeUnitWhere } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { getAssignableAgentUsers } from "@/lib/units/assignable-agents";
import { CsAgentPreviewBanner } from "@/components/layout/cs-agent-preview-banner";
import { UnitsTable } from "@/components/units/units-table";
import {
  isAdminUnitManager,
  isCommunityManagementRole,
  isLimitedExportRole,
} from "@/lib/auth/unit-roles";
import { communityManagedUnitWhere } from "@/lib/auth/community-project-scope";
import { parseUnitsPageFilters } from "@/lib/units/units-filter-url";

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const t = await getTranslations("units");
  const filters = parseUnitsPageFilters(await searchParams);
  const csScope =
    session?.user.role === "CS_AGENT"
      ? await resolveCsAgentScope(session.user)
      : null;

  const communityScope = session?.user.role &&
    isCommunityManagementRole(session.user.role)
    ? await communityManagedUnitWhere()
    : {};

  const [units, staffUsers, projectRecords] = await Promise.all([
    prisma.unit.findMany({
      where: activeUnitWhere(communityScope),
      include: {
        project: true,
        client: true,
        agent: true,
        contractWorkflow: true,
      },
      orderBy: [{ project: { name: "asc" } }, { unitCode: "asc" }],
    }),
    getAssignableAgentUsers(),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
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
      {csScope?.isPreview && csScope.previewSourceEmail ? (
        <CsAgentPreviewBanner previewSourceEmail={csScope.previewSourceEmail} />
      ) : null}
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <UnitsTable
        data={rows}
        projects={projects}
        agents={agents}
        statuses={statuses}
        defaultHandoverGroupFilter={filters.handover}
        canExport={
          session?.user.role ? !isLimitedExportRole(session.user.role) : true
        }
        canCreateUnit={
          session?.user.role ? isAdminUnitManager(session.user.role) : false
        }
        createUnitProjects={projectRecords}
        createUnitAgents={staffUsers}
      />
    </div>
  );
}
