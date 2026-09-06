"use client";

import { Medal } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildCasesFilterUrl } from "@/lib/cases/cases-filter-url";
import type { AgentKPIRow } from "@/lib/cases/kpi-types";
import { sortAgentsForLeaderboard } from "@/lib/cases/kpi-types";
import { premiumCardHoverClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";

const rankStyles = [
  "border-amber-400/50 bg-gradient-to-r from-amber-500/15 to-amber-400/5",
  "border-slate-300/60 bg-gradient-to-r from-slate-400/15 to-slate-300/5",
  "border-orange-400/40 bg-gradient-to-r from-orange-600/15 to-orange-400/5",
];

export function PerformanceLeaderboard({ rows }: { rows: AgentKPIRow[] }) {
  const t = useTranslations("performance");
  const sorted = sortAgentsForLeaderboard(rows);

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("noAgents")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(premiumCardHoverClass)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Medal className="size-5 text-amber-500" />
          {t("leaderboard")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((row, index) => (
          <div
            key={row.agentId}
            className={cn(
              "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
              index < 3 ? rankStyles[index] : "border-border/60 bg-muted/20"
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                  index === 0
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-200"
                    : index === 1
                      ? "bg-slate-500/15 text-slate-700 dark:text-slate-200"
                      : index === 2
                        ? "bg-orange-500/15 text-orange-800 dark:text-orange-200"
                        : "bg-muted text-muted-foreground"
                )}
              >
                {index + 1}
              </span>
              <div>
                <Link
                  href={buildCasesFilterUrl({ agent: row.agentId, status: "open" })}
                  className="font-semibold hover:underline"
                >
                  {row.agentName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {t("score")}: {Math.round(row.score * 10) / 10}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="tabular-nums">
                {t("metrics.resolvedThisMonth")}: {row.resolvedCount}
              </Badge>
              <Badge variant="outline" className="tabular-nums">
                {t("metrics.activityVolume")}: {row.activityCount}
              </Badge>
              {row.avgResolutionDays != null ? (
                <Badge variant="outline" className="tabular-nums">
                  {t("metrics.avgResolutionTime")}: {row.avgResolutionDays}{" "}
                  {t("daysUnit")}
                </Badge>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
