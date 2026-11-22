import { projectNameToSlug } from "@/lib/cases/cases-filter-url";
import type { CasesPageFilters } from "@/lib/cases/cases-filter-url";
import { isFollowUpDue } from "@/lib/cases/follow-up-sprint";
import { isCaseOwnedByUser } from "@/lib/cases/ownership";
import { OPEN_TICKET_STATUSES } from "@/lib/cases/workflow";
import type { CaseMetricCategoryKey } from "@/lib/cases/cases-filter-url";
import {
  primaryOpenStatusForUnit,
  type OpenWorkPrimaryStatus,
} from "@/lib/executive/open-work-status";
import {
  primaryPendingPartyForUnit,
  type ActivePendingParty,
} from "@/lib/executive/pending-party-primary";
import type { ExecutiveCaseRow } from "@/lib/cases/executive-dashboard";

export type CaseDashboardRow = {
  id: string;
  unitId: string;
  project: string;
  category: string;
  status: string;
  pendingParty: string;
  nextFollowUpDate: string;
  agentId: string | null;
  unitAgentId: string | null;
  effectiveAgentId: string | null;
  notes: string;
  unitCode?: string;
  client?: string;
};

export function isOpenCaseStatus(status: string): boolean {
  return OPEN_TICKET_STATUSES.includes(
    status as (typeof OPEN_TICKET_STATUSES)[number]
  );
}

/** Executive / team-queue definition: no ticket agent and no unit agent. */
export function isFullyUnassignedCase(row: CaseDashboardRow): boolean {
  return row.agentId == null && row.unitAgentId == null;
}

function matchesCategoryBreakdown(
  row: CaseDashboardRow,
  key: CaseMetricCategoryKey
): boolean {
  switch (key) {
    case "legal":
      return row.status === "LEGAL" || row.category === "LEGAL";
    case "engineering":
      return row.status === "ENGINEERING";
    case "customerService":
      return row.category === "CUSTOMER_SERVICE";
    case "feedbackHistory":
      return row.category === "FEEDBACK_HISTORY";
    case "general":
      return row.category === "GENERAL";
    default:
      return true;
  }
}

function ticketQueuePriority(row: CaseDashboardRow) {
  const unassigned = isFullyUnassignedCase(row);
  if (unassigned) return 0;
  if (row.status === "LEGAL" || row.category === "LEGAL") return 1;
  if (row.status === "ENGINEERING") return 2;
  if (row.status === "PENDING") return 3;
  return 4;
}

function pickRepresentativeTicketPerUnit<T extends CaseDashboardRow>(
  rows: T[]
): T[] {
  const byUnit = new Map<string, T>();
  for (const row of rows) {
    const existing = byUnit.get(row.unitId);
    if (!existing || ticketQueuePriority(row) < ticketQueuePriority(existing)) {
      byUnit.set(row.unitId, row);
    }
  }
  return [...byUnit.values()];
}

function unitIdsMatchingPrimary(
  rows: CaseDashboardRow[],
  predicate: (unitTickets: CaseDashboardRow[]) => boolean
): Set<string> {
  const byUnit = new Map<string, CaseDashboardRow[]>();
  for (const row of rows) {
    if (!isOpenCaseStatus(row.status)) continue;
    const list = byUnit.get(row.unitId) ?? [];
    list.push(row);
    byUnit.set(row.unitId, list);
  }
  const ids = new Set<string>();
  for (const [unitId, unitRows] of byUnit) {
    if (predicate(unitRows)) ids.add(unitId);
  }
  return ids;
}

function toExecutiveShape(rows: CaseDashboardRow[]): ExecutiveCaseRow[] {
  return rows.map((row) => ({
    id: row.id,
    unitId: row.unitId,
    unitCode: "",
    project: row.project,
    client: "",
    notes: row.notes,
    category: row.category,
    status: row.status,
    pendingParty: row.pendingParty,
    agentId: row.agentId,
    agentName: "",
    unitAgentId: row.unitAgentId,
    isMine: false,
  }));
}

export function filterCaseDashboardRows<T extends CaseDashboardRow>(
  rows: T[],
  filters: CasesPageFilters,
  options?: {
    viewerUserId?: string;
    agents?: Array<{ id: string; name: string }>;
  }
): T[] {
  const viewerUserId = options?.viewerUserId;
  const agents = options?.agents;
  let working = rows;

  if (filters.queue === "team" && viewerUserId) {
    working = working.filter(
      (row) => !isCaseOwnedByUser(row.agentId, row.unitAgentId, viewerUserId)
    );
  }

  if (filters.status === "RESOLVED" && filters.metricCategory !== "all") {
    const resolved = working.filter((row) => row.status === "RESOLVED");
    const categoryFiltered = resolved.filter((row) =>
      matchesCategoryBreakdown(row, filters.metricCategory as CaseMetricCategoryKey)
    );
    if (filters.distinctUnit) {
      return pickRepresentativeTicketPerUnit(categoryFiltered);
    }
    return categoryFiltered;
  }

  const openRows = working.filter((row) => isOpenCaseStatus(row.status));

  let primaryUnitIds: Set<string> | null = null;
  if (filters.primaryStatus && filters.primaryStatus !== "all") {
    const shaped = toExecutiveShape(openRows);
    const byUnit = new Map<string, ExecutiveCaseRow[]>();
    for (const row of shaped) {
      const list = byUnit.get(row.unitId) ?? [];
      list.push(row);
      byUnit.set(row.unitId, list);
    }
    primaryUnitIds = new Set<string>();
    for (const [unitId, unitRows] of byUnit) {
      if (primaryOpenStatusForUnit(unitRows) === filters.primaryStatus) {
        primaryUnitIds.add(unitId);
      }
    }
  }

  let categoryUnitIds: Set<string> | null = null;
  if (filters.metricCategory && filters.metricCategory !== "all") {
    categoryUnitIds = unitIdsMatchingPrimary(openRows, (unitTickets) =>
      unitTickets.some((row) =>
        matchesCategoryBreakdown(row, filters.metricCategory as CaseMetricCategoryKey)
      )
    );
  }

  let pendingPartyUnitIds: Set<string> | null = null;
  if (
    filters.distinctUnit &&
    filters.pendingParty !== "all" &&
    filters.status === "open"
  ) {
    const shaped = toExecutiveShape(openRows);
    const byUnit = new Map<string, ExecutiveCaseRow[]>();
    for (const row of shaped) {
      const list = byUnit.get(row.unitId) ?? [];
      list.push(row);
      byUnit.set(row.unitId, list);
    }
    pendingPartyUnitIds = new Set<string>();
    for (const [unitId, unitRows] of byUnit) {
      const primary = primaryPendingPartyForUnit(unitRows);
      if (primary === filters.pendingParty) {
        pendingPartyIdsAdd(pendingPartyUnitIds, unitId);
      }
    }
  }

  const filtered = working.filter((row) => {
    if (
      filters.status === "open" &&
      !isOpenCaseStatus(row.status)
    ) {
      return false;
    }
    if (
      filters.status !== "all" &&
      filters.status !== "open" &&
      row.status !== filters.status
    ) {
      return false;
    }
    if (filters.category !== "all" && row.category !== filters.category) {
      return false;
    }
    if (filters.project !== "all") {
      if (projectNameToSlug(row.project) !== filters.project) return false;
    }
    if (filters.agent === "unassigned") {
      if (!isFullyUnassignedCase(row)) return false;
    } else if (filters.agent !== "all" && agents) {
      const filterAgent = agents.find(
        (agent) => agent.id === filters.agent || agent.name === filters.agent
      );
      if (filterAgent) {
        if (row.effectiveAgentId !== filterAgent.id) return false;
      }
    }
    if (filters.followUp === "due" && !isFollowUpDue(row.nextFollowUpDate)) {
      return false;
    }
    if (
      filters.pendingParty !== "all" &&
      !filters.distinctUnit &&
      row.pendingParty !== filters.pendingParty
    ) {
      return false;
    }
    if (primaryUnitIds && !primaryUnitIds.has(row.unitId)) return false;
    if (categoryUnitIds && !categoryUnitIds.has(row.unitId)) return false;
    if (pendingPartyUnitIds && !pendingPartyUnitIds.has(row.unitId)) {
      return false;
    }
    if (filters.awaitingParty) {
      if (row.pendingParty === "NONE" || !row.pendingParty) return false;
    }
    return true;
  });

  if (filters.distinctUnit) {
    return pickRepresentativeTicketPerUnit(filtered);
  }
  return filtered;
}

function pendingPartyIdsAdd(set: Set<string>, unitId: string) {
  set.add(unitId);
}

export function countCaseDashboardRows<T extends CaseDashboardRow>(
  rows: T[],
  filters: CasesPageFilters,
  options?: {
    viewerUserId?: string;
    agents?: Array<{ id: string; name: string }>;
  }
): number {
  return filterCaseDashboardRows(rows, filters, options).length;
}

export type ExecutiveDrillDownPreset = {
  status?: CasesPageFilters["status"];
  primaryStatus?: OpenWorkPrimaryStatus;
  agent?: string;
  distinctUnit?: boolean;
  queue?: CasesPageFilters["queue"];
  followUp?: CasesPageFilters["followUp"];
  pendingParty?: string;
  metricCategory?: CaseMetricCategoryKey;
  project?: string;
};

export function executiveDrillDownFilters(
  preset: ExecutiveDrillDownPreset
): CasesPageFilters {
  return {
    status: preset.status ?? "open",
    project: preset.project ?? "all",
    category: preset.metricCategory ? "all" : "all",
    agent: preset.agent ?? "all",
    followUp: preset.followUp ?? "all",
    pendingParty: preset.pendingParty ?? "all",
    distinctUnit: preset.distinctUnit ?? false,
    queue: preset.queue ?? "all",
    primaryStatus: preset.primaryStatus ?? "all",
    metricCategory: preset.metricCategory ?? "all",
    awaitingParty: false,
  };
}

export function pendingPartyDrillDownFilters(
  party: ActivePendingParty
): CasesPageFilters {
  return {
    status: "open",
    project: "all",
    category: "all",
    agent: "all",
    followUp: "all",
    pendingParty: party,
    distinctUnit: true,
    queue: "all",
    primaryStatus: "all",
    metricCategory: "all",
    awaitingParty: false,
  };
}