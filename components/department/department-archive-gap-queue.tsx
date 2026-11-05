import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DepartmentGapCompleteButton } from "@/components/archive-check/department-gap-complete-button";

export async function DepartmentArchiveGapTasksQueue({
  tasks,
}: {
  tasks: Array<{
    id: string;
    itemKey: string;
    deadlineAt: Date;
    ownerRole: string;
    unitRequestId: string;
    unit: { unitCode: string; project: { name: string } };
  }>;
}) {
  const t = await getTranslations("archiveCheck.gapTasks");
  const tItems = await getTranslations("operations.items");
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
            <div
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">
                  {task.unit.project.name} · {task.unit.unitCode}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tItems(task.itemKey)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {task.deadlineAt.toLocaleDateString(locale)}
                </Badge>
                <Button variant="secondary" size="sm" render={
                  <Link href={`/requests/${task.unitRequestId}`} />
                }>
                  {t("openRequest")}
                </Button>
                <DepartmentGapCompleteButton gapTaskId={task.id} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
