"use client";

import { useLocale, useTranslations } from "next-intl";

import { formatCurrency } from "@/lib/format/currency";
import type { ExecutiveFinancials } from "@/lib/executive/financial-analytics";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import {
  entranceAnimationClass,
  premiumCardHoverClass,
  staggerEntranceClass,
} from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExecutiveFinanceDataCheck } from "@/components/executive/executive-finance-data-check";

export function ExecutiveFinancialsPanel({
  financials,
}: {
  financials: ExecutiveFinancials;
}) {
  const locale = useLocale();
  const t = useTranslations("executive.financials");
  const { project: projectLabel } = useDomainLabels();

  const { grandTotal } = financials;
  const included = grandTotal.pricedUnitCount;
  const flagged = grandTotal.flaggedUnitCount;

  if (financials.byProject.length === 0) {
    return (
      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Card className="border-dashed shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("feesNote")}</p>
        <p className="text-xs font-medium text-muted-foreground">
          {t("qualitySummary", { included, flagged })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {financials.byProject.map((row, index) => (
          <Card
            key={row.project}
            className={cn(
              "border-s-2 border-s-[var(--color-chart-1)]/70 bg-card shadow-sm",
              premiumCardHoverClass,
              entranceAnimationClass,
              staggerEntranceClass(index)
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-base">
                {projectLabel(row.project)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("pricedUnitCount", { count: row.pricedUnitCount })}
              </p>
              {row.flaggedUnitCount > 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t("projectFlagged", { count: row.flaggedUnitCount })}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("totalFinishing")}</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(row.totalFinishingPrice, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("doorFees")}</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(row.doorFees, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("aluminumFees")}</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(row.aluminumFees, locale)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card
          className={cn(
            "border-s-2 border-s-emerald-500/80 bg-gradient-to-br from-emerald-500/5 to-card shadow-sm md:col-span-2 xl:col-span-3",
            premiumCardHoverClass,
            entranceAnimationClass,
            staggerEntranceClass(financials.byProject.length)
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base">{t("grandTotal")}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("pricedUnitCount", { count: grandTotal.pricedUnitCount })}
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">{t("totalFinishing")}</p>
              <p className="font-heading text-2xl font-bold tabular-nums">
                {formatCurrency(grandTotal.totalFinishingPrice, locale)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("doorFees")}</p>
              <p className="font-heading text-2xl font-bold tabular-nums">
                {formatCurrency(grandTotal.doorFees, locale)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("aluminumFees")}</p>
              <p className="font-heading text-2xl font-bold tabular-nums">
                {formatCurrency(grandTotal.aluminumFees, locale)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ExecutiveFinanceDataCheck flaggedUnits={financials.flaggedUnits} />
    </section>
  );
}
