import { endOfMonth, startOfMonth } from "date-fns";

import { isFollowUpDue } from "@/lib/cases/follow-up-sprint";
import type { AgentKPIRow } from "@/lib/cases/kpi-types";
import { prisma, activeTicketWhere } from "@/lib/prisma";

export type { AgentKPIRow } from "@/lib/cases/kpi-types";
export { sortAgentsForLeaderboard, sortAgentsForSlacking } from "@/lib/cases/kpi-types";

export function getDefaultKpiPeriod(now = new Date()) {
  return {
    startDate: startOfMonth(now),
    endDate: endOfMonth(now),
  };
}

function effectiveAgentId(ticket: {
  agentId: string | null;
  unit: { agentId: string | null };
}): string | null {
  return ticket.agentId ?? ticket.unit.agentId;
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function computeScore(
  resolvedCount: number,
  activityCount: number,
  avgResolutionDays: number | null
): number {
  const base = resolvedCount * 2 + activityCount;
  if (avgResolutionDays == null) return base;
  return base - avgResolutionDays * 0.01;
}

export async function getAgentKPIs(
  startDate: Date,
  endDate: Date
): Promise<AgentKPIRow[]> {
  const now = new Date();
  const staleCutoff = new Date(now);
  staleCutoff.setDate(staleCutoff.getDate() - 7);

  const agents = await prisma.user.findMany({
    where: {
      role: "CS_AGENT",
      deletedAt: null,
      NOT: { email: { endsWith: "@imported.njd.local" } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (agents.length === 0) return [];

  const agentIds = new Set(agents.map((agent) => agent.id));

  const [periodTickets, openTickets] = await Promise.all([
    prisma.ticket.findMany({
      where: activeTicketWhere({
        OR: [
          {
            resolvedAt: { gte: startDate, lte: endDate },
            status: "RESOLVED",
          },
          {
            createdAt: { gte: startDate, lte: endDate },
          },
        ],
      }),
      select: {
        id: true,
        agentId: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        updatedAt: true,
        nextFollowUpDate: true,
        unit: { select: { agentId: true } },
      },
    }),
    prisma.ticket.findMany({
      where: activeTicketWhere({
        status: { not: "RESOLVED" },
      }),
      select: {
        id: true,
        agentId: true,
        status: true,
        updatedAt: true,
        nextFollowUpDate: true,
        unit: { select: { agentId: true } },
      },
    }),
  ]);

  const rows: AgentKPIRow[] = agents.map((agent) => {
    const resolvedDurations: number[] = [];
    let resolvedCount = 0;
    let activityCount = 0;
    let overdueCount = 0;
    let staleCount = 0;

    for (const ticket of periodTickets) {
      const ownerId = effectiveAgentId(ticket);
      if (ownerId !== agent.id) continue;

      if (
        ticket.status === "RESOLVED" &&
        ticket.resolvedAt &&
        ticket.resolvedAt >= startDate &&
        ticket.resolvedAt <= endDate
      ) {
        resolvedCount += 1;
        resolvedDurations.push(
          daysBetween(ticket.createdAt, ticket.resolvedAt)
        );
      }
    }

    for (const ticket of periodTickets) {
      if (ticket.agentId !== agent.id) continue;
      if (
        ticket.createdAt >= startDate &&
        ticket.createdAt <= endDate
      ) {
        activityCount += 1;
      }
    }

    for (const ticket of openTickets) {
      const ownerId = effectiveAgentId(ticket);
      if (ownerId !== agent.id) continue;

      if (
        ticket.nextFollowUpDate &&
        isFollowUpDue(ticket.nextFollowUpDate.toISOString(), now)
      ) {
        overdueCount += 1;
      }

      if (ticket.updatedAt < staleCutoff) {
        staleCount += 1;
      }
    }

    const avgResolutionDays =
      resolvedDurations.length > 0
        ? resolvedDurations.reduce((sum, value) => sum + value, 0) /
          resolvedDurations.length
        : null;

    return {
      agentId: agent.id,
      agentName: agent.name,
      resolvedCount,
      avgResolutionDays:
        avgResolutionDays != null
          ? Math.round(avgResolutionDays * 10) / 10
          : null,
      activityCount,
      overdueCount,
      staleCount,
      score: computeScore(resolvedCount, activityCount, avgResolutionDays),
    };
  });

  return rows
    .filter((row) => agentIds.has(row.agentId))
    .sort((a, b) => {
      if (b.resolvedCount !== a.resolvedCount) {
        return b.resolvedCount - a.resolvedCount;
      }
      return b.score - a.score;
    });
}
