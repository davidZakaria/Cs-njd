import type { Role } from "@prisma/client";

import {
  callLogDedupeKey,
  parseCallLogTicketId,
} from "@/lib/notifications/call-log-dedupe";
import type { CallLogSeenInfo } from "@/lib/notifications/call-log-seen-types";
import { basePrisma } from "@/lib/prisma";

export type { CallLogSeenInfo } from "@/lib/notifications/call-log-seen-types";

export function roleShowsCallLogSeenStatus(role: Role): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "MANAGEMENT" ||
    role === "COMMUNITY_MANAGEMENT"
  );
}

type InboxRow = {
  id: string;
  dedupeKey: string | null;
};

export async function attachCallLogSeenToItems(
  items: InboxRow[],
  viewerRole: Role
): Promise<Map<string, CallLogSeenInfo>> {
  const result = new Map<string, CallLogSeenInfo>();
  if (!roleShowsCallLogSeenStatus(viewerRole)) {
    return result;
  }

  const ticketIds: string[] = [];
  const itemIdsByTicket = new Map<string, string[]>();

  for (const item of items) {
    const ticketId = parseCallLogTicketId(item.dedupeKey);
    if (!ticketId) continue;
    ticketIds.push(ticketId);
    const list = itemIdsByTicket.get(ticketId) ?? [];
    list.push(item.id);
    itemIdsByTicket.set(ticketId, list);
  }

  if (ticketIds.length === 0) return result;

  const tickets = await basePrisma.ticket.findMany({
    where: { id: { in: ticketIds } },
    select: {
      id: true,
      unit: {
        select: {
          agentId: true,
          agent: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  const dedupeKeys = ticketIds.map((id) => callLogDedupeKey(id));
  const agentIds = [
    ...new Set(
      tickets
        .map((t) => t.unit.agentId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const agentNotifications =
    agentIds.length > 0
      ? await basePrisma.notification.findMany({
          where: {
            dedupeKey: { in: dedupeKeys },
            userId: { in: agentIds },
            inboxTab: "CALL_LOG",
          },
          select: {
            dedupeKey: true,
            userId: true,
            isRead: true,
            readAt: true,
          },
        })
      : [];

  const agentNotifByDedupe = new Map(
    agentNotifications.map((row) => [row.dedupeKey ?? "", row])
  );

  for (const ticketId of ticketIds) {
    const ticket = ticketById.get(ticketId);
    const dedupeKey = callLogDedupeKey(ticketId);
    const inboxIds = itemIdsByTicket.get(ticketId) ?? [];

    let info: CallLogSeenInfo;
    const agentId = ticket?.unit.agentId ?? null;
    if (!agentId) {
      info = { kind: "no_agent", agentName: null, readAt: null };
    } else {
      const agentName =
        ticket?.unit.agent?.name?.trim() ||
        ticket?.unit.agent?.email?.trim() ||
        "CS Agent";
      const agentRow = agentNotifByDedupe.get(dedupeKey);
      if (agentRow?.isRead && agentRow.readAt) {
        info = {
          kind: "seen",
          agentName,
          readAt: agentRow.readAt.toISOString(),
        };
      } else {
        info = { kind: "not_seen", agentName, readAt: null };
      }
    }

    for (const inboxId of inboxIds) {
      result.set(inboxId, info);
    }
  }

  return result;
}