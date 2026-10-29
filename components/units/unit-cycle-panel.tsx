import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

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
  openRequests = [],
}: {
  unitId: string;
  userRole: Role | undefined;
  userId: string | undefined;
  unitAgentId: string | null;
  locale: string;
  openRequests?: Array<{
    id: string;
    type: import("@prisma/client").UnitRequestType;
    status: import("@prisma/client").UnitRequestStatus;
    unitCycleStageKey: import("@prisma/client").UnitCycleStageKey | null;
  }>;
}) {
  const cycle = await loadUnitCycleForUnit(unitId);
  if (!cycle) return null;

  const t = await getTranslations("unitCycle");
  const tRequests = await getTranslations("requests.unitPanel");
  const tEnums = await getTranslations({ locale, namespace: "enums" });
  const activeKey = cycle.activeStageKey;
  const canManageStage =
    userRole != null &&
    activeKey != null &&
    roleCanOwnStage(userRole, activeKey) &&
    (userRole !== "CS_AGENT" || unitAgentId === userId);

  const showAudit = userRole != null && managementRolesForCycle().includes(userRole);

  const stageRequests =
    activeKey != null
      ? openRequests.filter(
          (r) =>
            r.unitCycleStageKey === activeKey &&
            r.status !== "APPROVED" &&
            r.status !== "REJECTED" &&
            r.status !== "CANCELLED"
        )
      : [];

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
      />
      {stageRequests.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{tRequests("stageTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stageRequests.map((request) => (
              <Link
                key={request.id}
                href={`/requests/${request.id}`}
                className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/40"
              >
                <span>{tEnums(`unitRequestType.${request.type}`)}</span>
                <span className="text-muted-foreground">
                  {tEnums(`unitRequestStatus.${request.status}`)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
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
