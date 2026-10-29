import type {
  UnitCycleStageKey,
  UnitRequestApproverKind,
  UnitRequestStatus,
  UnitRequestType,
} from "@prisma/client";

export type UnitRequestListRow = {
  id: string;
  type: UnitRequestType;
  status: UnitRequestStatus;
  dueDate: Date | null;
  submittedAt: Date | null;
  currentApproverKind: UnitRequestApproverKind | null;
  escalatedToManagement: boolean;
  requestedById: string;
  requestedByName: string;
  unitId: string;
  unitCode: string;
  projectName: string;
  clientName: string;
  unitAgentId: string | null;
  unitCycleStageKey: UnitCycleStageKey | null;
};

export type RequestsPageFilters = {
  view: "awaiting" | "submitted" | "all";
  status: "all" | UnitRequestStatus;
  type: "all" | UnitRequestType;
  project: string;
  overdue: "all" | "yes";
};

export type OverdueUnitRequestRow = UnitRequestListRow & { daysOverdue: number };
