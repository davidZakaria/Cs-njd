import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OverdueStageRow, UnitCycleStageTaskRow } from "@/lib/unit-cycle/queries";
import { cn } from "@/lib/utils";

export async function MyStageTasksQueue({
  tasks,
}: {
  tasks: UnitCycleStageTaskRow[];
}) {
  const t = await getTranslations("unitCycle.myTasks");
  const tStages = await getTranslations("unitCycle.stages");
  const locale = await getLocale();

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((task) => (
          <Link
            key={`${task.unitId}-${task.stageKey}`}
            href={`/units/${task.unitId}`}
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/40",
              task.overdue && "border-destructive/40 bg-destructive/5"
            )}
          >
            <div>
              <p className="font-medium">
                {task.projectName} · {task.unitCode}
              </p>
              <p className="text-sm text-muted-foreground">
                {tStages(task.stageKey as "CONTRACT")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {task.checklistPassed}/{task.checklistTotal}
              </Badge>
              {task.deadlineAt ? (
                <span className="text-xs text-muted-foreground">
                  {new Date(task.deadlineAt).toLocaleDateString(locale)}
                </span>
              ) : null}
              {task.overdue ? (
                <Badge variant="destructive">{t("overdue")}</Badge>
              ) : null}
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export async function OverdueStagesList({
  tasks,
}: {
  tasks: OverdueStageRow[];
}) {
  const t = await getTranslations("unitCycle.overdue");
  const locale = await getLocale();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          tasks.map((task) => (
            <Link
              key={`${task.unitId}-overdue`}
              href={`/units/${task.unitId}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 hover:bg-destructive/10"
            >
              <div>
                <p className="font-medium">
                  {task.projectName} · {task.unitCode}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("row", {
                    stage: task.stageKey,
                    days: task.daysOverdue,
                  })}
                </p>
              </div>
              {task.deadlineAt ? (
                <span className="text-xs">{new Date(task.deadlineAt).toLocaleDateString(locale)}</span>
              ) : null}
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
