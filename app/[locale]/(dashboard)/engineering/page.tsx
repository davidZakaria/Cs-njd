import { auth } from "@/lib/auth";
import { resolveCsAgentScope } from "@/lib/auth/cs-agent-scope";
import { canAccessEngineeringPortal } from "@/lib/auth/role-permissions";
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
  if (!canAccessEngineeringPortal(session.user.role)) {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations("engineering");
  const tasks = await getEngineeringQueueUnits();
  const isCsAgent = session.user.role === "CS_AGENT";
  const csScope = isCsAgent ? await resolveCsAgentScope(session.user) : null;

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
          <p className="text-muted-foreground">
            {isCsAgent ? t("csAgentTasks") : t("myTasks")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground/90">
            {isCsAgent ? t("csAgentPortalHint") : t("sharedAccountHint")}
          </p>
        </div>
      </div>

      <EngineeringQueuePanel
        tasks={tasks}
        csEffectiveAgentId={csScope?.effectiveAgentId ?? null}
      />
    </div>
  );
}
