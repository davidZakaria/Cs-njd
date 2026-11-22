import { describe, expect, it } from "vitest";

import {
  countCaseDashboardRows,
  filterCaseDashboardRows,
  isFullyUnassignedCase,
} from "@/lib/cases/case-dashboard-filters";
import type { CasesPageFilters } from "@/lib/cases/cases-filter-url";
import { countUniqueUnits } from "@/lib/executive/executive-stats";
import { computeOpenWorkPrimaryStatusBreakdown } from "@/lib/executive/open-work-status";
import type { ExecutiveCaseRow } from "@/lib/cases/executive-dashboard";
import {
  countUnitDashboardRows,
  mapUnitToDashboardRow,
  matchesUnitDashboardFilters,
} from "@/lib/units/unit-dashboard-filters";
import type { UnitsPageFilters } from "@/lib/units/units-filter-url";
import { buildCasesFilterUrl } from "@/lib/cases/cases-filter-url";
import { buildUnitsFilterUrl } from "@/lib/units/units-filter-url";

const baseCaseFilters: CasesPageFilters = {
  status: "all",
  project: "all",
  category: "all",
  agent: "all",
  followUp: "all",
  pendingParty: "all",
  distinctUnit: false,
  queue: "all",
  primaryStatus: "all",
  metricCategory: "all",
  awaitingParty: false,
};

const baseUnitFilters: UnitsPageFilters = {
  handover: "all",
  delivery: "all",
  fees: "all",
  signedProtocol: "all",
  agent: "all",
  project: "all",
};

function makeCaseRow(
  partial: Partial<ReturnType<typeof caseRow>> & { id: string; unitId: string }
) {
  return caseRow(partial);
}

function caseRow(
  partial: Partial<{
    id: string;
    unitId: string;
    status: string;
    category: string;
    agentId: string | null;
    unitAgentId: string | null;
    effectiveAgentId: string | null;
    pendingParty: string;
    project: string;
  }> & { id: string; unitId: string }
) {
  return {
    id: partial.id,
    unitId: partial.unitId,
    project: partial.project ?? "Green Avenue",
    category: partial.category ?? "GENERAL",
    status: partial.status ?? "PENDING",
    pendingParty: partial.pendingParty ?? "NONE",
    nextFollowUpDate: "",
    agentId: partial.agentId ?? null,
    unitAgentId: partial.unitAgentId ?? null,
    effectiveAgentId: partial.effectiveAgentId ?? null,
    notes: "",
    unitCode: "U-1",
    client: "Client",
  };
}

function executiveRowsFromCases(
  rows: ReturnType<typeof caseRow>[]
): ExecutiveCaseRow[] {
  return rows.map((row) => ({
    id: row.id,
    unitId: row.unitId,
    unitCode: row.unitCode,
    project: row.project,
    client: row.client,
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

describe("dashboard count ↔ list parity (seeded rows)", () => {
  it("unassigned executive KPI matches distinct-unit list filter", () => {
    const rows = [
      makeCaseRow({ id: "t1", unitId: "u1", agentId: null, unitAgentId: null }),
      makeCaseRow({ id: "t2", unitId: "u1", agentId: null, unitAgentId: null }),
      makeCaseRow({
        id: "t3",
        unitId: "u2",
        agentId: "agent-1",
        unitAgentId: null,
        effectiveAgentId: "agent-1",
      }),
    ];
    const teamRows = rows;
    const kpiCount = countUniqueUnits(executiveRowsFromCases(teamRows), (row) =>
      !row.agentId && !row.unitAgentId
    );
    const filters: CasesPageFilters = {
      ...baseCaseFilters,
      status: "open",
      agent: "unassigned",
      distinctUnit: true,
    };
    expect(countCaseDashboardRows(rows, filters)).toBe(kpiCount);
    expect(filterCaseDashboardRows(rows, filters).length).toBe(kpiCount);
  });

  it("primary legal open-work KPI matches list filter", () => {
    const rows = [
      makeCaseRow({
        id: "t1",
        unitId: "u1",
        status: "PENDING",
        category: "LEGAL",
      }),
      makeCaseRow({ id: "t2", unitId: "u1", status: "LEGAL", category: "LEGAL" }),
      makeCaseRow({ id: "t3", unitId: "u2", status: "PENDING", category: "GENERAL" }),
    ];
    const primary = computeOpenWorkPrimaryStatusBreakdown(executiveRowsFromCases(rows));
    const filters: CasesPageFilters = {
      ...baseCaseFilters,
      status: "open",
      primaryStatus: "LEGAL",
      distinctUnit: true,
    };
    expect(countCaseDashboardRows(rows, filters)).toBe(primary.LEGAL);
  });

  it("signed protocol missing treats no active workflow like the units list", () => {
    const today = new Date("2026-06-01T12:00:00Z");
    const onlyDeletedWorkflow = mapUnitToDashboardRow({
      project: { name: "Demo" },
      agent: null,
      agentId: null,
      contractWorkflow: null,
      finishing: null,
    });
    const filters: UnitsPageFilters = {
      ...baseUnitFilters,
      signedProtocol: "missing",
    };
    expect(matchesUnitDashboardFilters(onlyDeletedWorkflow, filters, today)).toBe(
      true
    );
  });

  it("legal handover units: active workflow status matches unit list filter", () => {
    const today = new Date("2026-06-01T12:00:00Z");
    const unitA = mapUnitToDashboardRow({
      project: { name: "Green Avenue" },
      agent: { name: "Agent" },
      agentId: "a1",
      contractWorkflow: {
        handoverStatus: "DELIVERY_WARNING",
        deliveryDate: null,
        signedProtocolStoredName: null,
        hasPaidFees: true,
        deletedAt: null,
      },
      finishing: null,
    });
    const unitB = mapUnitToDashboardRow({
      project: { name: "Green Avenue" },
      agent: null,
      agentId: null,
      contractWorkflow: {
        handoverStatus: "DELIVERY_WARNING",
        deliveryDate: null,
        signedProtocolStoredName: null,
        hasPaidFees: true,
        deletedAt: new Date(),
      },
      finishing: null,
    });
    const rows = [unitA, unitB];
    const filters: UnitsPageFilters = {
      ...baseUnitFilters,
      handover: "legal",
    };
    const listTotal = countUnitDashboardRows(rows, filters, today);
    expect(listTotal).toBe(1);
    expect(matchesUnitDashboardFilters(unitA, filters, today)).toBe(true);
    expect(matchesUnitDashboardFilters(unitB, filters, today)).toBe(false);
  });
});

describe("dashboard drill-down URLs carry list filters", () => {
  it("executive unassigned URL encodes distinct units and team queue", () => {
    expect(buildCasesFilterUrl({
      status: "open",
      agent: "unassigned",
      distinctUnit: true,
      queue: "team",
    })).toBe(
      "/cases?status=open&agent=unassigned&distinctUnit=1&queue=team"
    );
  });

  it("legal dispute units URL encodes handover group", () => {
    expect(buildUnitsFilterUrl({ handover: "legal" })).toBe(
      "/units?handover=legal"
    );
  });
});