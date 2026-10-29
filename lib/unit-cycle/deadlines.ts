import type { Project, UnitCycleStageKey } from "@prisma/client";

export function deadlineDaysForStage(
  project: Pick<
    Project,
    | "unitCycleContractDeadlineDays"
    | "unitCycleFinanceDeadlineDays"
    | "unitCycleEngineeringDeadlineDays"
    | "unitCycleLegalHandoverDeadlineDays"
  >,
  stageKey: UnitCycleStageKey
): number {
  switch (stageKey) {
    case "CONTRACT":
      return project.unitCycleContractDeadlineDays;
    case "FINANCE":
      return project.unitCycleFinanceDeadlineDays;
    case "ENGINEERING":
      return project.unitCycleEngineeringDeadlineDays;
    case "LEGAL_HANDOVER":
      return project.unitCycleLegalHandoverDeadlineDays;
    default:
      return 7;
  }
}

export function computeStageDeadline(
  startedAt: Date,
  days: number
): Date {
  const deadline = new Date(startedAt);
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}
