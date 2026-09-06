import { auth } from "@/lib/auth";
import { getEngineeringQueueUnits } from "@/lib/engineering/queue";
import { getDomainLabels } from "@/lib/i18n/domain-labels";
import { HardHat } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";

export default async function EngineeringPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login?reason=session_expired`);
  }
  if (session.user.role !== "ENGINEER") {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations("engineering");
  const labels = await getDomainLabels(locale);
  const tasks = await getEngineeringQueueUnits(session.user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className={cn(entranceAnimationClass, "flex items-start gap-3")}>
        <div className="rounded-xl bg-primary/15 p-3 text-primary">
          <HardHat className="size-6" />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            {t("portalTitle")}
          </h1>
          <p className="text-muted-foreground">{t("myTasks")}</p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("noTasks")}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {tasks.map((task) => {
            const projectLabel = labels.project(task.projectName);
            const hasMods = Boolean(String(task.customModifications ?? "").trim());

            return (
              <li key={task.id}>
                <Card className="overflow-hidden shadow-premium transition-shadow hover:shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{task.unitCode}</CardTitle>
                    <p className="text-sm text-muted-foreground">{projectLabel}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {hasMods ? (
                      <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-950/30">
                        <p className="font-medium text-amber-900 dark:text-amber-100">
                          {t("customModifications")}
                        </p>
                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-amber-950 dark:text-amber-50">
                          {task.customModifications}
                        </p>
                      </div>
                    ) : null}
                    {task.phases.some((phase) => phase !== "NOT_STARTED") ? (
                      <div className="flex flex-wrap gap-1.5">
                        {task.phases.map((phase) => (
                          <Badge key={phase} variant="secondary">
                            {labels.finishingPhase(phase)}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <Button
                      nativeButton={false}
                      className="h-11 w-full text-base"
                      render={
                        <Link href={`/engineering/units/${task.id}`} />
                      }
                    >
                      {t("updateFinishes")}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
