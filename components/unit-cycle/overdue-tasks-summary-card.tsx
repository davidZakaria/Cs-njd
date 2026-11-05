import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  buildOverdueTasksPageUrl,
  type OverdueTasksFilterParams,
} from "@/lib/unit-cycle/overdue-filter-url";
import type { OverdueStageRow } from "@/lib/unit-cycle/queries";
import { summarizeOverdueByStage } from "@/lib/unit-cycle/queries";
import { cn } from "@/lib/utils";

export async function OverdueTasksSummaryCard({
  tasks,
}: {
  tasks: OverdueStageRow[];
}) {
  const t = await getTranslations("unitCycle.overdueManagement");
  const tStages = await getTranslations("unitCycle.stages");
  const summary = summarizeOverdueByStage(tasks);
  const total = tasks.length;

  return (
    <Card className={cn(total > 0 && "border-destructive/30")}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-lg">{t("summaryTitle")}</CardTitle>
        <Link
          href="/executive/overdue-tasks"
          className={buttonVariants({ variant: total > 0 ? "default" : "outline", size: "sm" })}
        >
          {t("viewAll")}
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">{t("summaryEmpty")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("summaryTotal", { count: total })}
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.map((entry) => (
                <Link
                  key={entry.stageKey}
                  href={buildOverdueTasksPageUrl({
                    stage: entry.stageKey as OverdueTasksFilterParams["stage"],
                  })}
                  className="inline-flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm transition-colors hover:bg-destructive/10"
                >
                  <span>{tStages(entry.stageKey as "CONTRACT")}</span>
                  <Badge variant="destructive">{entry.count}</Badge>
                </Link>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
