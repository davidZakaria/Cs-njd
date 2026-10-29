import { getTranslations } from "next-intl/server";

import { UnitCycleStepper } from "@/components/units/unit-cycle-stepper";
import { loadUnitCycleForUnit } from "@/lib/actions/unit-cycle";
import {
  managementRolesForCycle,
  roleCanOwnStage,
} from "@/lib/unit-cycle/owners";
import type { Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format/datetime";

export async function UnitCyclePanel({
  unitId,
  userRole,
  userId,
  unitAgentId,
  locale,
}: {
  unitId: string;
  userRole: Role | undefined;
  userId: string | undefined;
  unitAgentId: string | null;
  locale: string;
}) {
  const cycle = await loadUnitCycleForUnit(unitId);
  if (!cycle) return null;

  const t = await getTranslations("unitCycle");
  const activeKey = cycle.activeStageKey;
  const canManageStage =
    userRole != null &&
    activeKey != null &&
    roleCanOwnStage(userRole, activeKey) &&
    (userRole !== "CS_AGENT" || unitAgentId === userId);

  const canApproveEngineering =
    userRole === "CS_AGENT" && unitAgentId === userId && activeKey === "ENGINEERING";

  const showAudit = userRole != null && managementRolesForCycle().includes(userRole);

  return (
    <div className="space-y-4">
      <UnitCycleStepper
        unitId={unitId}
        activeStageKey={activeKey}
        stages={cycle.stages.map((stage) => ({
          stageKey: stage.stageKey,
          status: stage.status,
          deadlineAt: stage.deadlineAt?.toISOString() ?? null,
          blockedReason: stage.blockedReason,
          checklist: stage.checklist,
          checklistComplete: stage.checklistComplete,
        }))}
        canManageStage={canManageStage}
        canApproveEngineering={canApproveEngineering}
      />
      {showAudit && cycle.events.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("auditTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {cycle.events.map((event) => (
                <li key={event.id} className="flex flex-wrap gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t(`auditActions.${event.action}`, {
                      defaultValue: event.action,
                    })}
                  </span>
                  {event.stageKey ? (
                    <span>{t(`stages.${event.stageKey}`)}</span>
                  ) : null}
                  <span>{formatDateTime(event.createdAt, locale)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
