import { auth } from "@/lib/auth";
import { resolveCsAgentScope } from "@/lib/auth/cs-agent-scope";
import {
  canAccessEngineeringPortal,
  canSubmitEngineeringSiteUpdate,
  isCsAgentAssignedToUnit,
} from "@/lib/auth/role-permissions";
import { isCsAgentRole } from "@/lib/auth/unit-roles";
import { isUnitInEngineeringQueue } from "@/lib/engineering/queue";
import { getDomainLabels } from "@/lib/i18n/domain-labels";
import { prisma, notDeleted } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { EngineeringTaskForm } from "@/components/engineering/engineering-task-form";
import { Link } from "@/i18n/navigation";

export default async function EngineeringUnitTaskPage({
  params,
}: {
  params: Promise<{ locale: string; unitId: string }>;
}) {
  const { locale, unitId } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login?reason=session_expired`);
  }
  if (!canAccessEngineeringPortal(session.user.role)) {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations("engineering");
  const labels = await getDomainLabels(locale);
  const csScope = isCsAgentRole(session.user.role)
    ? await resolveCsAgentScope(session.user)
    : null;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      project: true,
      finishing: true,
      tickets: {
        where: notDeleted,
        select: {
          id: true,
          pendingParty: true,
          status: true,
          deletedAt: true,
          engineeringNotes: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!unit) notFound();

  if (!isUnitInEngineeringQueue(unit)) {
    redirect(`/${locale}/engineering`);
  }

  const engineeringTicket = unit.tickets.find(
    (ticket) =>
      ticket.status !== "RESOLVED" && ticket.pendingParty === "ENGINEERING"
  );

  const projectLabel = await labels.project(unit.project.name);
  const readOnly = !canSubmitEngineeringSiteUpdate(session.user.role);
  const canEditUnitFinishing =
    csScope != null &&
    isCsAgentAssignedToUnit(csScope, { unitAgentId: unit.agentId });

  return (
    <div className="space-y-4">
      <Link
        href="/engineering"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← {t("myTasks")}
      </Link>
      <EngineeringTaskForm
        unitId={unit.id}
        unitCode={unit.unitCode}
        projectLabel={projectLabel}
        packageType={unit.finishing?.packageType ?? null}
        phases={
          unit.finishing?.phases?.length
            ? unit.finishing.phases
            : unit.finishing?.phase
              ? [unit.finishing.phase]
              : []
        }
        customModifications={unit.finishing?.customModifications ?? null}
        modificationsCompleted={unit.finishing?.modificationsCompleted ?? true}
        engineeringNotes={engineeringTicket?.engineeringNotes ?? null}
        readOnly={readOnly}
        canEditUnitFinishing={canEditUnitFinishing}
      />
    </div>
  );
}
