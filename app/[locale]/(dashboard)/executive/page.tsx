import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getExecutiveDashboardData } from "@/lib/cases/executive-dashboard";
import {
  EXECUTIVE_FINANCIALS_ENABLED,
  getExecutiveFinancials,
} from "@/lib/executive/financial-analytics";
import { ExecutiveCommandCenter } from "@/components/executive/executive-command-center";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";
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
  const financials = EXECUTIVE_FINANCIALS_ENABLED
    ? await getExecutiveFinancials()
    : null;

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
          href="/cases"
          className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
        >
          {t("viewAllCases")}
        </Link>
      </div>

      <div className={cn(entranceAnimationClass, "animate-delay-150")}>
        <ExecutiveCommandCenter data={data} financials={financials} />
      </div>
    </div>
  );
}
