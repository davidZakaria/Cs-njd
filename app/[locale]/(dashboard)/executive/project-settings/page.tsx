import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { ProjectUnitCycleSettingsPanel } from "@/components/unit-cycle/project-settings-panel";
import { prisma } from "@/lib/prisma";
import { managementRolesForCycle } from "@/lib/unit-cycle/owners";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";

export const dynamic = "force-dynamic";

export default async function ExecutiveProjectSettingsPage() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations("unitCycle.projectSettings");

  if (
    !session?.user ||
    !managementRolesForCycle().includes(session.user.role)
  ) {
    redirect(`/${locale}/dashboard`);
  }

  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      unitCycleEnabled: true,
      unitCycleContractDeadlineDays: true,
      unitCycleFinanceDeadlineDays: true,
      unitCycleEngineeringDeadlineDays: true,
      unitCycleLegalHandoverDeadlineDays: true,
    },
  });

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-gradient-to-br from-muted/30 via-background to-background p-6 shadow-sm ring-1 ring-foreground/5",
          entranceAnimationClass
        )}
      >
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
          <p className="max-w-2xl text-muted-foreground">{t("pageSubtitle")}</p>
        </div>
        <Link href="/executive" className={buttonVariants({ variant: "outline" })}>
          {t("backToExecutive")}
        </Link>
        <Link
          href="/executive/document-templates"
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("documentTemplatesLink")}
        </Link>
      </div>
      <ProjectUnitCycleSettingsPanel
        projects={projects.map((project) => ({
          projectId: project.id,
          projectName: project.name,
          unitCycleEnabled: project.unitCycleEnabled,
          unitCycleContractDeadlineDays: project.unitCycleContractDeadlineDays,
          unitCycleFinanceDeadlineDays: project.unitCycleFinanceDeadlineDays,
          unitCycleEngineeringDeadlineDays: project.unitCycleEngineeringDeadlineDays,
          unitCycleLegalHandoverDeadlineDays: project.unitCycleLegalHandoverDeadlineDays,
        }))}
      />
    </div>
  );
}
