"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildCasesFilterUrl } from "@/lib/cases/cases-filter-url";
import type { AgentKPIRow } from "@/lib/cases/kpi-types";
import { sortAgentsForSlacking } from "@/lib/cases/kpi-types";
import { premiumCardHoverClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";

export function PerformanceSlackingBoard({ rows }: { rows: AgentKPIRow[] }) {
  const t = useTranslations("performance");
  const flagged = sortAgentsForSlacking(rows).filter(
    (row) => row.overdueCount > 0 || row.staleCount > 0
  );

  if (flagged.length === 0) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("metrics.overdueFollowUps")}: 0 · {t("metrics.staleCases")}: 0
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        premiumCardHoverClass,
        "border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-background"
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
          <AlertTriangle className="size-5 text-amber-600" />
          {t("slacking")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {flagged.map((row) => (
          <div
            key={row.agentId}
            className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <Link
              href={buildCasesFilterUrl({
                agent: row.agentId,
                status: "open",
                followUp: row.overdueCount > 0 ? "due" : undefined,
              })}
              className="font-semibold hover:underline"
            >
              {row.agentName}
            </Link>
            <div className="flex flex-wrap gap-2">
              {row.overdueCount > 0 ? (
                <Badge
                  variant="outline"
                  className="border-red-500/40 bg-red-500/10 px-3 py-1 text-base tabular-nums text-red-800 dark:text-red-200"
                >
                  {t("metrics.overdueFollowUps")}: {row.overdueCount}
                </Badge>
              ) : null}
              {row.staleCount > 0 ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 px-3 py-1 text-base tabular-nums text-amber-900 dark:text-amber-100"
                >
                  {t("metrics.staleCases")}: {row.staleCount}
                </Badge>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
