"use server";

import { auth } from "@/lib/auth";
import {
  canAccessCommunityDailyTracker,
  CommunityTrackerAccessError,
  getCommunityDailyActivity,
  type CommunityDailyActivityResult,
  type CommunityDailyKpis,
} from "@/lib/services/community-tracker";
import type { CommunityActivityActionType } from "@/lib/community-tracker/types";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";

export type SerializedCommunityActivityItem = {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  actionType: CommunityActivityActionType;
  unitId: string;
  unitCode: string;
  ticketId: string;
  snippet: string;
};

export type SerializedCommunityDailyActivity = {
  rangeStart: string;
  rangeEnd: string;
  agents: Array<{ id: string; name: string }>;
  kpis: CommunityDailyKpis;
  kpisByAgent: Record<string, CommunityDailyKpis>;
  activities: SerializedCommunityActivityItem[];
};

function serializeActivityResult(
  result: CommunityDailyActivityResult
): SerializedCommunityDailyActivity {
  return {
    rangeStart: result.rangeStart.toISOString(),
    rangeEnd: result.rangeEnd.toISOString(),
    agents: result.agents,
    kpis: result.kpis,
    kpisByAgent: result.kpisByAgent,
    activities: result.activities.map((item) => ({
      ...item,
      timestamp: item.timestamp.toISOString(),
    })),
  };
}

function parseTrackerDate(dateInput: string): Date | null {
  const trimmed = dateInput.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function assertCommunityTrackerAccess() {
  const session = await auth();
  if (
    !session?.user ||
    !canAccessCommunityDailyTracker(session.user.role)
  ) {
    return { ok: false as const, error: actionFail("Unauthorized") };
  }
  return { ok: true as const, session };
}

export async function loadCommunityDailyActivity(input: {
  date: string;
  agentId?: string;
}): Promise<ActionResult & { data?: SerializedCommunityDailyActivity }> {
  const access = await assertCommunityTrackerAccess();
  if (!access.ok) return access.error;

  const day = parseTrackerDate(input.date);
  if (!day) return actionFail("Invalid date");

  const agentId =
    input.agentId && input.agentId !== "all" ? input.agentId : undefined;

  try {
    const result = await getCommunityDailyActivity(
      day,
      access.session.user,
      agentId
    );
    return { ...actionOk(), data: serializeActivityResult(result) };
  } catch (error) {
    if (error instanceof CommunityTrackerAccessError) {
      return actionFail("Unauthorized");
    }
    throw error;
  }
}

export async function getInitialCommunityDailyActivity(
  date: string,
  agentId?: string
): Promise<SerializedCommunityDailyActivity> {
  const access = await assertCommunityTrackerAccess();
  if (!access.ok) {
    throw new Error("Unauthorized");
  }

  const day = parseTrackerDate(date);
  if (!day) {
    throw new Error("Invalid date");
  }

  const result = await getCommunityDailyActivity(
    day,
    access.session.user,
    agentId && agentId !== "all" ? agentId : undefined
  );
  return serializeActivityResult(result);
}

export type { CommunityTrackerViewerRole } from "@/lib/community-tracker/types";
