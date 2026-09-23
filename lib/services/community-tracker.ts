import type { TicketCategory } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CommunityActivityActionType =
  | "TICKET_OPENED"
  | "CALL_LOGGED"
  | "TIMELINE_NOTE"
  | "STATUS_CHANGE"
  | "CASE_RESOLVED";

export type CommunityDailyActivityItem = {
  id: string;
  timestamp: Date;
  agentId: string;
  agentName: string;
  actionType: CommunityActivityActionType;
  unitId: string;
  unitCode: string;
  ticketId: string;
  snippet: string;
};

export type CommunityDailyKpis = {
  ticketsCreatedCount: number;
  callsLoggedCount: number;
  notesCount: number;
  resolvedCount: number;
};

export type CommunityDailyActivityResult = {
  rangeStart: Date;
  rangeEnd: Date;
  agents: Array<{ id: string; name: string }>;
  kpis: CommunityDailyKpis;
  kpisByAgent: Record<string, CommunityDailyKpis>;
  activities: CommunityDailyActivityItem[];
};

const CALL_NOTE_PREFIX = "📞";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function emptyKpis(): CommunityDailyKpis {
  return {
    ticketsCreatedCount: 0,
    callsLoggedCount: 0,
    notesCount: 0,
    resolvedCount: 0,
  };
}

export function isCommunityCallLog(
  category: TicketCategory,
  notes: string
): boolean {
  return (
    category === "FEEDBACK_HISTORY" &&
    notes.trimStart().startsWith(CALL_NOTE_PREFIX)
  );
}

function classifyTicketCreate(
  category: TicketCategory,
  notes: string,
  status: string
): CommunityActivityActionType {
  if (isCommunityCallLog(category, notes)) return "CALL_LOGGED";
  if (category === "FEEDBACK_HISTORY") return "TIMELINE_NOTE";
  if (status === "RESOLVED") return "CASE_RESOLVED";
  return "TICKET_OPENED";
}

function snippetFromNotes(notes: string, maxLen = 160): string {
  const oneLine = notes.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen - 1)}…`;
}

function ticketJsonStatus(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const status = (data as { status?: unknown }).status;
  return typeof status === "string" ? status : null;
}

async function loadCommunityAgents(agentId?: string) {
  return prisma.user.findMany({
    where: {
      role: "COMMUNITY_MANAGEMENT",
      deletedAt: null,
      isActive: true,
      ...(agentId ? { id: agentId } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

function incrementKpi(
  bucket: CommunityDailyKpis,
  action: CommunityActivityActionType
) {
  switch (action) {
    case "TICKET_OPENED":
      bucket.ticketsCreatedCount += 1;
      break;
    case "CALL_LOGGED":
      bucket.callsLoggedCount += 1;
      break;
    case "TIMELINE_NOTE":
      bucket.notesCount += 1;
      break;
    case "CASE_RESOLVED":
      bucket.resolvedCount += 1;
      break;
    case "STATUS_CHANGE":
      break;
  }
}

export async function getCommunityDailyActivity(
  date: Date,
  agentId?: string
): Promise<CommunityDailyActivityResult> {
  const rangeStart = startOfDay(date);
  const rangeEnd = endOfDay(date);

  const agents = await loadCommunityAgents(agentId);
  const agentIds = agents.map((agent) => agent.id);
  const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name]));

  const kpis = emptyKpis();
  const kpisByAgent: Record<string, CommunityDailyKpis> = Object.fromEntries(
    agentIds.map((id) => [id, emptyKpis()])
  );
  const activities: CommunityDailyActivityItem[] = [];

  if (agentIds.length === 0) {
    return { rangeStart, rangeEnd, agents, kpis, kpisByAgent, activities };
  }

  const createdTickets = await prisma.ticket.findMany({
    where: {
      createdById: { in: agentIds },
      createdAt: { gte: rangeStart, lte: rangeEnd },
    },
    select: {
      id: true,
      unitId: true,
      notes: true,
      category: true,
      status: true,
      createdAt: true,
      createdById: true,
      createdBy: { select: { name: true } },
      unit: { select: { unitCode: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const ticket of createdTickets) {
    const actorId = ticket.createdById;
    if (!actorId) continue;

    const actionType = classifyTicketCreate(
      ticket.category,
      ticket.notes,
      ticket.status
    );
    const agentName =
      ticket.createdBy?.name ?? agentNameById.get(actorId) ?? "—";

    activities.push({
      id: `create-${ticket.id}`,
      timestamp: ticket.createdAt,
      agentId: actorId,
      agentName,
      actionType,
      unitId: ticket.unitId,
      unitCode: ticket.unit.unitCode,
      ticketId: ticket.id,
      snippet: snippetFromNotes(ticket.notes),
    });

    incrementKpi(kpis, actionType);
    const createAgentKpis = kpisByAgent[actorId];
    if (createAgentKpis) incrementKpi(createAgentKpis, actionType);
  }

  const ticketAudits = await prisma.auditLog.findMany({
    where: {
      userId: { in: agentIds },
      tableName: "Ticket",
      action: "UPDATE",
      timestamp: { gte: rangeStart, lte: rangeEnd },
    },
    orderBy: { timestamp: "asc" },
    select: {
      id: true,
      userId: true,
      recordId: true,
      timestamp: true,
      oldData: true,
      newData: true,
    },
  });

  const ticketIdsForAudit = [
    ...new Set(ticketAudits.map((row) => row.recordId)),
  ];

  const ticketsById =
    ticketIdsForAudit.length > 0
      ? new Map(
          (
            await prisma.ticket.findMany({
              where: { id: { in: ticketIdsForAudit } },
              select: {
                id: true,
                unitId: true,
                notes: true,
                unit: { select: { unitCode: true } },
              },
            })
          ).map((ticket) => [ticket.id, ticket])
        )
      : new Map<
          string,
          {
            id: string;
            unitId: string;
            notes: string;
            unit: { unitCode: string };
          }
        >();

  for (const audit of ticketAudits) {
    const actorId = audit.userId;
    if (!actorId) continue;

    const oldStatus = ticketJsonStatus(audit.oldData);
    const newStatus = ticketJsonStatus(audit.newData);
    if (!newStatus || oldStatus === newStatus) continue;

    const ticket = ticketsById.get(audit.recordId);
    if (!ticket) continue;

    const isResolved = newStatus === "RESOLVED";
    const actionType: CommunityActivityActionType = isResolved
      ? "CASE_RESOLVED"
      : "STATUS_CHANGE";

    const agentName = agentNameById.get(actorId) ?? "—";
    const snippet = isResolved
      ? `Resolved (${oldStatus ?? "?"} → ${newStatus})`
      : `Status ${oldStatus ?? "?"} → ${newStatus}`;

    activities.push({
      id: `audit-${audit.id}`,
      timestamp: audit.timestamp,
      agentId: actorId,
      agentName,
      actionType,
      unitId: ticket.unitId,
      unitCode: ticket.unit.unitCode,
      ticketId: ticket.id,
      snippet: `${snippet} · ${snippetFromNotes(ticket.notes, 80)}`,
    });

    if (isResolved) {
      incrementKpi(kpis, "CASE_RESOLVED");
      const agentBucket = kpisByAgent[actorId];
      if (agentBucket) incrementKpi(agentBucket, "CASE_RESOLVED");
    }
  }

  activities.sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  return {
    rangeStart,
    rangeEnd,
    agents,
    kpis,
    kpisByAgent,
    activities,
  };
}
