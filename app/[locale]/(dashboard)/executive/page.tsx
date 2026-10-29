import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getExecutiveDashboardData } from "@/lib/cases/executive-dashboard";
import { getAgentKPIs, getDefaultKpiPeriod } from "@/lib/cases/kpis";
import { canUseManagementOverride } from "@/lib/workflow/management-override";
import { getExecutivePortfolioMetrics } from "@/lib/executive/portfolio-analytics";
import { getExecutiveProjectUnitSummaries } from "@/lib/executive/project-unit-summaries";
import {
  EXECUTIVE_FINANCIALS_ENABLED,
  getExecutiveFinancials,
} from "@/lib/executive/financial-analytics";
import { ExecutiveCommandCenter } from "@/components/executive/executive-command-center";
import { getOverdueStagesForManagement, getMyStageTasks } from "@/lib/unit-cycle/queries";
import {
  MyStageTasksQueue,
  OverdueStagesList,
} from "@/components/unit-cycle/stage-task-queues";
import {
  getInitialCommunityDailyActivity,
  type CommunityTrackerViewerRole,
} from "@/lib/actions/community-tracker";
import { format } from "date-fns";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ExecutiveDashboardPage() {
  const session = await auth();
  const t = await getTranslations("executive");

  if (
    !session?.user ||
    !["MANAGEMENT", "SUPER_ADMIN"].includes(session.user.role)
  ) {
    const locale = await getLocale();
    redirect(`/${locale}/dashboard`);
  }

  const { startDate, endDate } = getDefaultKpiPeriod();

  const communityTrackerDate = format(new Date(), "yyyy-MM-dd");

  const [data, portfolio, projectSummaries, financials, kpis, communityDailyActivity, myStageTasks, overdueStages] =
    await Promise.all([
      getExecutiveDashboardData(session.user.id),
      getExecutivePortfolioMetrics(),
      getExecutiveProjectUnitSummaries(),
      EXECUTIVE_FINANCIALS_ENABLED
        ? getExecutiveFinancials()
        : Promise.resolve(null),
      getAgentKPIs(startDate, endDate),
      getInitialCommunityDailyActivity(communityTrackerDate),
      getMyStageTasks({
        prisma,
        userId: session.user.id,
        role: session.user.role,
      }),
      getOverdueStagesForManagement(prisma),
    ]);

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-gradient-to-br from-muted/30 via-background to-background p-6 shadow-sm",
          "ring-1 ring-foreground/5",
          entranceAnimationClass,
          "animate-delay-75"
        )}
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-chart-1)]">
            {t("projectPortfolio")}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="max-w-2xl text-muted-foreground">
            {t("subtitle", { name: session.user.name })}
          </p>
        </div>
        <Link
          href="/executive/project-settings"
          className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
        >
          {t("projectSettings")}
        </Link>
        <Link
          href="/cases"
          className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
        >
          {t("viewAllCases")}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MyStageTasksQueue tasks={myStageTasks} />
        <OverdueStagesList tasks={overdueStages} />
      </div>

      <div className={cn(entranceAnimationClass, "animate-delay-150")}>
        <ExecutiveCommandCenter
          data={data}
          portfolio={portfolio}
          projectSummaries={projectSummaries}
          financials={financials}
          kpis={kpis}
          communityDailyActivity={communityDailyActivity}
          communityTrackerDate={communityTrackerDate}
          communityTrackerViewerRole={
            session.user.role as CommunityTrackerViewerRole
          }
          canUseManagementOverride={canUseManagementOverride(session.user)}
        />
      </div>
    </div>
  );
}
