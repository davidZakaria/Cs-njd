import { auth } from "@/lib/auth";
import { getEngineeringQueueUnits } from "@/lib/engineering/queue";
import { HardHat } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { EngineeringQueuePanel } from "@/components/engineering/engineering-queue-panel";
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

      <EngineeringQueuePanel tasks={tasks} />
    </div>
  );
}
