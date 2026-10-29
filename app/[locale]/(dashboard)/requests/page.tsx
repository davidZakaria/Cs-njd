import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolveCsAgentScope } from "@/lib/auth/cs-agent-scope";
import { canAccessRequestsDashboard } from "@/lib/auth/role-permissions";
import { loadAllUnitRequestRows } from "@/lib/requests/load-requests";
import { filterRequestRowsForUser } from "@/lib/requests/queries";
import { parseRequestsPageFilters } from "@/lib/requests/requests-filter-url";
import { basePrisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { RequestsTable } from "@/components/requests/requests-table";
import { CreateUnitRequestForm } from "@/components/requests/create-unit-request-form";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";
import { canCreateUnitRequest } from "@/lib/requests/permissions";

export const dynamic = "force-dynamic";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user || !canAccessRequestsDashboard(session.user.role)) {
    redirect("/login");
  }

  const filters = parseRequestsPageFilters(await searchParams);
  const t = await getTranslations("requests");
  const csScope =
    session.user.role === "CS_AGENT"
      ? await resolveCsAgentScope(session.user)
      : null;

  const allRows = await loadAllUnitRequestRows(basePrisma);
  const rows = filterRequestRowsForUser({
    rows: allRows,
    role: session.user.role,
    userId: session.user.id,
    csScope,
    filters,
  });

  const projects = [...new Set(allRows.map((row) => row.projectName))].sort();

  const tableRows = rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    dueDate: row.dueDate?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    currentApproverKind: row.currentApproverKind,
    escalatedToManagement: row.escalatedToManagement,
    requestedByName: row.requestedByName,
    unitId: row.unitId,
    unitCode: row.unitCode,
    projectName: row.projectName,
    clientName: row.clientName,
  }));

  const canCreate = canCreateUnitRequest(session.user.role);

  return (
    <div className={cn("space-y-6", entranceAnimationClass)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      {canCreate ? <CreateUnitRequestForm /> : null}
      <RequestsTable rows={tableRows} projects={projects} initialFilters={filters} />
    </div>
  );
}
