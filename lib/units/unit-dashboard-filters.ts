import type { HandoverStatus } from "@prisma/client";
import { projectNameToSlug } from "@/lib/cases/cases-filter-url";
import {
  isCancelledHandover,
  isDeliveredHandover,
} from "@/lib/executive/handover-status-groups";
import {
  matchesUnitsHandoverGroup,
  type UnitsPageFilters,
} from "@/lib/units/units-filter-url";

/** Prisma include: only non–soft-deleted contract workflows on unit lists. */
export const unitListContractWorkflowInclude = {
  where: { deletedAt: null },
} as const;

export type UnitDashboardRow = {
  project: string;
  agent: string;
  handoverStatus: string;
  deliveryDate: Date | string | null;
  missingSignedProtocol: boolean;
  feesOutstanding: boolean;
  agentUnassigned: boolean;
};

type UnitWithWorkflowAndFinishing = {
  project: { name: string };
  agent: { name: string } | null;
  agentId: string | null;
  contractWorkflow: {
    handoverStatus: HandoverStatus;
    deliveryDate: Date | null;
    signedProtocolStoredName: string | null;
    hasPaidFees: boolean;
    deletedAt: Date | null;
  } | null;
  finishing: { doorFees: number | null; aluminumFees: number | null } | null;
};

export function activeHandoverStatus(
  workflow: UnitWithWorkflowAndFinishing["contractWorkflow"]
): HandoverStatus | "PENDING" {
  if (!workflow || workflow.deletedAt != null) return "PENDING";
  return workflow.handoverStatus;
}

export function mapUnitToDashboardRow(
  unit: UnitWithWorkflowAndFinishing
): UnitDashboardRow {
  const workflow = unit.contractWorkflow;
  const handover = activeHandoverStatus(workflow);
  return {
    project: unit.project.name,
    agent: unit.agent?.name ?? "-",
    handoverStatus: handover,
    deliveryDate: workflow?.deliveryDate ?? null,
    missingSignedProtocol: !workflow?.signedProtocolStoredName,
    feesOutstanding:
      workflow?.hasPaidFees === false &&
      ((unit.finishing?.doorFees ?? 0) > 0 ||
        (unit.finishing?.aluminumFees ?? 0) > 0),
    agentUnassigned: unit.agentId == null,
  };
}

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function matchesUnitDashboardFilters(
  row: UnitDashboardRow,
  filters: UnitsPageFilters,
  filterTodayStart: Date | null
): boolean {
  if (filters.project !== "all") {
    const slug = projectNameToSlug(row.project);
    if (filters.project !== row.project && filters.project !== slug) {
      return false;
    }
  }
  if (filters.agent === "unassigned") {
    if (!row.agentUnassigned) return false;
  }
  if (
    filters.handover !== "all" &&
    !matchesUnitsHandoverGroup(row.handoverStatus, filters.handover)
  ) {
    return false;
  }
  if (filters.delivery === "overdue") {
    const deliveryDate = row.deliveryDate ? new Date(row.deliveryDate) : null;
    if (
      !deliveryDate ||
      !filterTodayStart ||
      deliveryDate >= filterTodayStart ||
      isDeliveredHandover(row.handoverStatus) ||
      isCancelledHandover(row.handoverStatus)
    ) {
      return false;
    }
  }
  if (filters.fees === "outstanding" && !row.feesOutstanding) return false;
  if (filters.signedProtocol === "missing" && !row.missingSignedProtocol) {
    return false;
  }
  return true;
}

export function countUnitDashboardRows(
  rows: UnitDashboardRow[],
  filters: UnitsPageFilters,
  filterTodayStart: Date | null
): number {
  return rows.filter((row) =>
    matchesUnitDashboardFilters(row, filters, filterTodayStart)
  ).length;
}