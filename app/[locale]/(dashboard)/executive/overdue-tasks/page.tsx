import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { OverdueTasksWorkspace } from "@/components/unit-cycle/overdue-tasks-workspace";
import { prisma } from "@/lib/prisma";
import { managementRolesForCycle } from "@/lib/unit-cycle/owners";
import {
  getOverdueStagesForManagement,
} from "@/lib/unit-cycle/queries";
import {
  parseOverdueTasksPageFilters,
  resolveOverdueProjectFilterParam,
} from "@/lib/unit-cycle/overdue-filter-url";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";

export const dynamic = "force-dynamic";

export default async function ExecutiveOverdueTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations("unitCycle.overdueManagement");

  if (
    !session?.user ||
    !managementRolesForCycle().includes(session.user.role)
  ) {
    redirect(`/${locale}/dashboard`);
  }

  const rawFilters = parseOverdueTasksPageFilters(await searchParams);
  const [projects, overdueRows] = await Promise.all([
    prisma.project.findMany({
      where: { unitCycleEnabled: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getOverdueStagesForManagement(prisma, 500),
  ]);

  const projectNames = projects.map((p) => p.name);
  const filters = {
    ...rawFilters,
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
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            {t("allTasksPageTitle")}
          </h1>
          <p className="max-w-2xl text-muted-foreground">{t("allTasksPageSubtitle")}</p>
        </div>
        <Link href="/executive" className={buttonVariants({ variant: "outline" })}>
          {t("backToExecutive")}
        </Link>
      </div>

      <OverdueTasksWorkspace
        rows={overdueRows}
        projects={projects}
        initialFilters={filters}
      />
    </div>
  );
}
