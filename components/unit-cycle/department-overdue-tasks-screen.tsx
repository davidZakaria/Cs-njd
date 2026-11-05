import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { OverdueTasksWorkspace } from "@/components/unit-cycle/overdue-tasks-workspace";
import {
  departmentOverdueTasksBasePath,
  type DepartmentOverdueHomeRole,
} from "@/lib/unit-cycle/department-overdue";
import {
  getDepartmentStaffOverdueStages,
} from "@/lib/unit-cycle/queries";
import {
  parseOverdueTasksPageFilters,
  resolveOverdueProjectFilterParam,
} from "@/lib/unit-cycle/overdue-filter-url";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DepartmentOverdueTasksScreen({
  role,
  searchParams = {},
}: {
  role: DepartmentOverdueHomeRole;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations("departmentHome.overdue");

  if (!session?.user || session.user.role !== role) {
    redirect(`/${locale}/login`);
  }

  const basePath = departmentOverdueTasksBasePath(role);
  const homePath = role === "LEGAL" ? "/legal" : "/finance";
  const rawFilters = parseOverdueTasksPageFilters(searchParams);
  const [projects, overdueRows] = await Promise.all([
    prisma.project.findMany({
      where: { unitCycleEnabled: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getDepartmentStaffOverdueStages({
      prisma,
      userId: session.user.id,
      role,
      limit: 500,
    }),
  ]);

  const projectNames = projects.map((p) => p.name);
  const filters = {
    ...rawFilters,
    department: role,
    project: resolveOverdueProjectFilterParam(rawFilters.project, projectNames),
  };

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-gradient-to-br from-muted/30 via-background to-background p-6 shadow-sm ring-1 ring-foreground/5",
          entranceAnimationClass
        )}
      >
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
          <p className="max-w-2xl text-muted-foreground">{t("pageSubtitle")}</p>
        </div>
        <Link href={homePath} className={buttonVariants({ variant: "outline" })}>
          {t("backToHome")}
        </Link>
      </div>

      <OverdueTasksWorkspace
        rows={overdueRows}
        projects={projects}
        initialFilters={filters}
        basePath={basePath}
        hideDepartmentFilter
      />
    </div>
  );
}
