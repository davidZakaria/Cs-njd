import type { PendingParty, TicketStatus } from "@prisma/client";

import {
  notifyEngineeringTask,
  notifyLegalEscalation,
  notifyManagerOverride,
  notifyUnitResolved,
} from "@/lib/notifications/triggers";

type TicketNotificationContext = {
  unit: {
    id: string;
    unitCode: string;
    agentId: string | null;
    assignedEngineerId?: string | null;
  };
  previousStatus: TicketStatus;
  previousPendingParty: PendingParty | null;
  nextStatus: TicketStatus;
  nextPendingParty: PendingParty | null;
  managementOverride: boolean;
  actorName: string;
};

export async function dispatchTicketWorkflowNotifications(
  ctx: TicketNotificationContext
): Promise<void> {
  const { unit, actorName } = ctx;

  const legalNow =
    ctx.nextStatus === "LEGAL" || ctx.nextPendingParty === "LEGAL";
  const legalBefore =
    ctx.previousStatus === "LEGAL" || ctx.previousPendingParty === "LEGAL";

  if (legalNow && !legalBefore) {
    await notifyLegalEscalation({
      unitCode: unit.unitCode,
      actorName,
    });
  }

  const engineeringNow =
    ctx.nextStatus === "ENGINEERING" ||
    ctx.nextPendingParty === "ENGINEERING";
  const engineeringBefore =
    ctx.previousStatus === "ENGINEERING" ||
    ctx.previousPendingParty === "ENGINEERING";

  if (engineeringNow && !engineeringBefore) {
    await notifyEngineeringTask({
      unitCode: unit.unitCode,
      unitId: unit.id,
      engineerUserId: unit.assignedEngineerId,
    });
  }

  if (
    ctx.nextStatus === "RESOLVED" &&
    ctx.previousStatus !== "RESOLVED"
  ) {
    if (ctx.managementOverride && unit.agentId) {
      await notifyManagerOverride({
        agentUserId: unit.agentId,
        unitCode: unit.unitCode,
        unitId: unit.id,
      });
    } else {
      await notifyUnitResolved({
        unitCode: unit.unitCode,
        actorName,
      });
    }
  }
}
