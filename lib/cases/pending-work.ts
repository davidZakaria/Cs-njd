import { prisma } from "@/lib/prisma";
import { activeTicketWhere } from "@/lib/prisma";
import {
  getCaseWorkflowKey,
  OPEN_TICKET_STATUSES,
  pickPrimaryOpenTicket,
  type CaseWorkflowKey,
} from "@/lib/cases/workflow";
import { isCaseOwnedByUser } from "@/lib/cases/ownership";
import type { Role } from "@prisma/client";

export type PendingWorkUnit = {
  unitId: string;
  unitCode: string;
  project: string;
  clientName: string;
  clientPhone: string | null;
  unitAgent: string | null;
  unitAgentId: string | null;
  openCount: number;
  primaryTicket: {
    id: string;
    notes: string;
    category: string;
    status: string;
    agentName: string | null;
    agentId: string | null;
    workflowKey: CaseWorkflowKey;
  };
  allOpenTicketIds: string[];
};

export async function getPendingWorkForSession(user: {
  id: string;
  role: Role;
  effectiveAgentId?: string;
}): Promise<PendingWorkUnit[]> {
  const agentId = user.effectiveAgentId ?? user.id;
  const ticketWhere =
    user.role === "CS_AGENT"
      ? activeTicketWhere({
          status: { in: OPEN_TICKET_STATUSES },
          OR: [{ agentId }, { unit: { agentId } }],
        })
      : activeTicketWhere({ status: { in: OPEN_TICKET_STATUSES } });

  const tickets = await prisma.ticket.findMany({
    where: ticketWhere,
    include: {
      agent: { select: { id: true, name: true } },
      unit: {
        include: {
          project: { select: { name: true } },
          client: { select: { name: true, phone1: true, phone2: true } },
          agent: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const byUnit = new Map<string, typeof tickets>();

  for (const ticket of tickets) {
    const list = byUnit.get(ticket.unitId) ?? [];
    list.push(ticket);
    byUnit.set(ticket.unitId, list);
  }

  const groups = [...byUnit.values()].map((unitTickets) => {
    const primary = pickPrimaryOpenTicket(unitTickets);
    const unit = primary.unit;
    const clientPhone =
      unit.client?.phone1?.trim() ||
      unit.client?.phone2?.trim() ||
      null;

    return {
      unitId: unit.id,
      unitCode: unit.unitCode,
      project: unit.project.name,
      clientName: unit.client?.name ?? "-",
      clientPhone,
      unitAgent: unit.agent?.name ?? null,
      unitAgentId: unit.agentId,
      openCount: unitTickets.length,
      primaryTicket: {
        id: primary.id,
        notes: primary.notes,
        category: primary.category,
        status: primary.status,
        agentName: primary.agent?.name ?? null,
        agentId: primary.agentId,
        workflowKey: getCaseWorkflowKey(
          primary.category,
          primary.status,
          primary.notes
        ),
      },
      allOpenTicketIds: unitTickets.map((t) => t.id),
    };
  });

  const priority = (item: PendingWorkUnit) => {
    const { workflowKey } = item.primaryTicket;
    if (workflowKey === "legalOpen") return 0;
    if (workflowKey === "customerServiceAwaiting") return 1;
    if (workflowKey === "engineeringOpen") return 2;
    if (workflowKey === "customerServiceActive") return 3;
    return 4;
  };

  return groups.sort((a, b) => priority(a) - priority(b));
}

export function splitPendingWorkForManager(
  items: PendingWorkUnit[],
  managerId: string
) {
  const mine: PendingWorkUnit[] = [];
  const team: PendingWorkUnit[] = [];

  for (const item of items) {
    if (
      isCaseOwnedByUser(
        item.primaryTicket.agentId,
        item.unitAgentId,
        managerId
      )
    ) {
      mine.push(item);
    } else {
      team.push(item);
    }
  }

  return { mine, team };
}
