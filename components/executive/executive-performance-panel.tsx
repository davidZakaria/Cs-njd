"use client";

import { useTranslations } from "next-intl";

import { PerformanceActivityChart } from "@/components/executive/performance-activity-chart";
import { PerformanceLeaderboard } from "@/components/executive/performance-leaderboard";
import { PerformanceSlackingBoard } from "@/components/executive/performance-slacking-board";
import { Badge } from "@/components/ui/badge";
import type { AgentKPIRow } from "@/lib/cases/kpi-types";

export function ExecutivePerformancePanel({ kpis }: { kpis: AgentKPIRow[] }) {
  const t = useTranslations("performance");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{t("periodThisMonth")}</Badge>
      </div>

      <PerformanceLeaderboard rows={kpis} />

      <PerformanceActivityChart rows={kpis} />

      <PerformanceSlackingBoard rows={kpis} />
    </div>
  );
}
