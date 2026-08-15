import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getExecutiveDashboardData } from "@/lib/cases/executive-dashboard";
import { ExecutiveQuickActionsTable } from "@/components/executive/executive-quick-actions-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  const data = await getExecutiveDashboardData(session.user.id);

  const statCards = [
    { label: t("stats.openTotal"), value: data.stats.openTotal },
    { label: t("stats.unassigned"), value: data.stats.unassigned },
    { label: t("stats.legal"), value: data.stats.legal },
    { label: t("stats.engineering"), value: data.stats.engineering },
    { label: t("stats.myOpen"), value: data.stats.myOpen },
    { label: t("stats.teamOpen"), value: data.stats.teamOpen },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle", { name: session.user.name })}
          </p>
        </div>
        <Link href="/cases" className={cn(buttonVariants({ variant: "outline" }))}>
          {t("viewAllCases")}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("agentWorkload")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.agentWorkload.map((agent) => (
            <Card key={agent.agentId ?? "unassigned"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{agent.agentName}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("stats.openTotal")}</p>
                  <p className="text-xl font-semibold">{agent.openCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("stats.pending")}</p>
                  <p className="text-xl font-semibold">{agent.pendingCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("stats.legal")}</p>
                  <p className="text-xl font-semibold">{agent.legalCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("stats.engineering")}</p>
                  <p className="text-xl font-semibold">{agent.engineeringCount}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t("teamQueueTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("teamQueueSubtitle")}</p>
        </div>
        <ExecutiveQuickActionsTable
          rows={data.teamQueue}
          agents={data.agents}
          canAssign={true}
          emptyLabel={t("teamQueueEmpty")}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t("myQueueTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("myQueueSubtitle")}</p>
        </div>
        <ExecutiveQuickActionsTable
          rows={data.myQueue}
          agents={data.agents}
          canAssign={false}
          emptyLabel={t("myQueueEmpty")}
        />
      </section>
    </div>
  );
}
