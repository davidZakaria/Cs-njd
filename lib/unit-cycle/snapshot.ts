import type { ContractWorkflow, Finishing, Unit } from "@prisma/client";

import {
  hasEngineeringCycleApproval,
  type UnitOperationsSnapshot,
} from "@/lib/operations/unit-cycle-progress";

export function buildUnitOperationsSnapshot(input: {
  unit: Pick<Unit, "contractPricePerMeter" | "area">;
  contractWorkflow: ContractWorkflow | null;
  finishing: Finishing | null;
  engineeringApprovals: { kind: import("@prisma/client").EngineeringApprovalKind }[];
}): UnitOperationsSnapshot {
  return {
    unit: {
      contractPricePerMeter: input.unit.contractPricePerMeter,
      area: input.unit.area,
    },
    contractWorkflow: input.contractWorkflow,
    finishing: input.finishing,
    engineeringReadinessSignedOff: hasEngineeringCycleApproval(
      input.engineeringApprovals
    ),
  };
}
