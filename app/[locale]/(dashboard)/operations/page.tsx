import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { canAccessOperationsProgressTracker } from "@/lib/auth/role-permissions";
import { getTranslations } from "next-intl/server";
import { loadOperationsProgressUnits } from "@/lib/operations/load-operations-units";
import { parseOperationsPageFilters } from "@/lib/operations/operations-filter-url";
import { aggregateOperationsProjectSummaries } from "@/lib/operations/operations-project-summary";
import { OperationsUnitsTable } from "@/components/operations/operations-units-table";
import { OperationsProjectSummaryBar } from "@/components/operations/operations-project-summary-bar";
import { OperationsArchiveCheckQueue } from "@/components/archive-check/operations-archive-check-queue";
import { loadOperationsArchiveCheckQueue } from "@/lib/archive-check/queries";
import { getAssignableAgentUsers } from "@/lib/units/assignable-agents";
import { prisma } from "@/lib/prisma";

export default async function OperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const session = await auth();
  const role = session?.user.role;

  if (!role || !canAccessOperationsProgressTracker(role)) {
    redirect({ href: "/", locale });
  }

  const t = await getTranslations("operations");
  const filters = parseOperationsPageFilters(await searchParams);

  const [rows, agents, projects, archiveChecks] = await Promise.all([
    loadOperationsProgressUnits(),
    getAssignableAgentUsers(),
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    loadOperationsArchiveCheckQueue({ role: role!, userId: session!.user.id }),
  ]);

  const projectNames = projects.map((p) => p.name);
  const summaries = aggregateOperationsProjectSummaries(
    rows.map((row) => ({
      project: row.project,
      projectSlug: row.projectSlug,
      progress: row.progress,
    }))
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <OperationsProjectSummaryBar summaries={summaries} />

      {role === "OPERATIONS" || role === "SUPER_ADMIN" ? (
        <OperationsArchiveCheckQueue rows={archiveChecks} />
      ) : null}

      <OperationsUnitsTable
        rows={rows}
        filters={filters}
        projectNames={projectNames}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
