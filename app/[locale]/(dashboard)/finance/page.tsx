import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { DepartmentAwaitingRequestsQueue } from "@/components/department/department-home-sections";
import { DepartmentArchiveGapTasksQueue } from "@/components/department/department-archive-gap-queue";
import { loadDepartmentArchiveGapTasks } from "@/lib/archive-check/queries";
import { MyStageTasksQueue } from "@/components/unit-cycle/stage-task-queues";
import { loadAllUnitRequestRows } from "@/lib/requests/load-requests";
import { filterRequestRowsForUser } from "@/lib/requests/queries.server";
import { getMyStageTasks } from "@/lib/unit-cycle/queries";
import { basePrisma, prisma } from "@/lib/prisma";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FinanceHomePage() {
  const session = await auth();
  const locale = await getLocale();
  if (!session?.user || session.user.role !== "FINANCE") {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("departmentHome");

  const [awaitingRows, myStageTasks, gapTasks] = await Promise.all([
    filterRequestRowsForUser({
      rows: await loadAllUnitRequestRows(basePrisma),
      role: session.user.role,
      userId: session.user.id,
      filters: { view: "awaiting", status: "all", type: "all", project: "all", overdue: "all" },
    }),
    getMyStageTasks({
      prisma,
      userId: session.user.id,
      role: session.user.role,
    }),
    loadDepartmentArchiveGapTasks({ role: session.user.role }),
  ]);

  return (
    <div className={cn("space-y-6", entranceAnimationClass)}>
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t("financeTitle")}</h1>
        <p className="text-muted-foreground">{t("financeSubtitle")}</p>
      </div>
      <DepartmentAwaitingRequestsQueue
        rows={awaitingRows}
        viewAllHref="/requests?view=awaiting"
      />
      <DepartmentArchiveGapTasksQueue
        tasks={gapTasks
          .filter((task) => task.unitRequest.unit != null)
          .map((task) => ({
            id: task.id,
            itemKey: task.itemKey,
            deadlineAt: task.deadlineAt,
            ownerRole: task.ownerRole,
            unitRequestId: task.unitRequestId,
            unit: task.unitRequest.unit!,
          }))}
      />
      <MyStageTasksQueue tasks={myStageTasks} />
    </div>
  );
}
