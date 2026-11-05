import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ClaimWorkButton } from "@/components/work/claim-work-button";
import {
  departmentOverdueTasksBasePath,
  type DepartmentOverdueHomeRole,
} from "@/lib/unit-cycle/department-overdue";
import {
  buildOverdueTasksPageUrl,
  type OverdueTasksFilterParams,
} from "@/lib/unit-cycle/overdue-filter-url";
import {
  splitPersonalAndPoolOverdueRows,
  summarizeOverdueByStage,
  type OverdueStageRow,
} from "@/lib/unit-cycle/queries";
import type { UnitCycleStageKey } from "@prisma/client";
import { cn } from "@/lib/utils";

const POOL_PREVIEW_LIMIT = 5;

export async function DepartmentOverdueSummaryCard({
  role,
  userId,
  rows,
}: {
  role: DepartmentOverdueHomeRole;
  userId: string;
  rows: OverdueStageRow[];
}) {
  const t = await getTranslations("departmentHome.overdue");
  const tStages = await getTranslations("unitCycle.stages");
  const basePath = departmentOverdueTasksBasePath(role);
  const { personal, pool } = splitPersonalAndPoolOverdueRows(rows, userId);
  const personalByStage = summarizeOverdueByStage(personal);
  const poolPreview = pool.slice(0, POOL_PREVIEW_LIMIT);

  const viewAllHref = buildOverdueTasksPageUrl(
    { department: role } satisfies OverdueTasksFilterParams,
    { basePath }
  );

  const empty = personal.length === 0 && pool.length === 0;

  return (
    <Card className={cn(!empty && "border-destructive/30")}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-lg">{t("title")}</CardTitle>
        {!empty ? (
          <Link
            href={viewAllHref}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("viewAll")}
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {empty ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <section className="space-y-2">
              <p className="text-sm font-medium">{t("personalHeading")}</p>
              {personal.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("personalEmpty")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {personalByStage.map((entry) => (
                    <Link
                      key={entry.stageKey}
                      href={buildOverdueTasksPageUrl(
                        {
                          department: role,
                          stage: entry.stageKey as UnitCycleStageKey,
                        },
                        { basePath }
                      )}
                      className="inline-flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm transition-colors hover:bg-destructive/10"
                    >
                      <span>{tStages(entry.stageKey as UnitCycleStageKey)}</span>
                      <Badge variant="destructive">{entry.count}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <p className="text-sm font-medium">
                {t("poolHeading", { count: pool.length })}
              </p>
              {pool.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("poolEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {poolPreview.map((task) => (
                    <li
                      key={`${task.unitId}-${task.stageKey}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {task.projectName} · {task.unitCode}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {tStages(task.stageKey as UnitCycleStageKey)} ·{" "}
                          {t("daysOverdue", { days: task.daysOverdue })}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {task.claimable ? (
                          <ClaimWorkButton kind="unitCycle" unitId={task.unitId} />
                        ) : null}
                        <Link
                          href={`/units/${task.unitId}`}
                          className={buttonVariants({ size: "sm", variant: "default" })}
                        >
                          {t("openUnit")}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {pool.length > POOL_PREVIEW_LIMIT ? (
                <Link href={viewAllHref} className="text-sm font-medium text-[var(--color-chart-1)]">
                  {t("poolMore", { count: pool.length - POOL_PREVIEW_LIMIT })}
                </Link>
              ) : null}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
