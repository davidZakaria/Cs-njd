import type { ContractWorkflow, Finishing, Unit, UnitCycle } from "@prisma/client";

import type { UnitOperationsSnapshot } from "@/lib/operations/operations-progress";

export function buildUnitOperationsSnapshot(input: {
  unit: Pick<Unit, "contractPricePerMeter" | "area">;
  contractWorkflow: ContractWorkflow | null;
  finishing: Finishing | null;
  unitCycle: Pick<
    UnitCycle,
    "engineeringCsApprovedAt" | "engineeringCsApprovedByUserId"
  > | null;
}): UnitOperationsSnapshot {
  return {
    unit: {
      contractPricePerMeter: input.unit.contractPricePerMeter,
      area: input.unit.area,
    },
    contractWorkflow: input.contractWorkflow,
    finishing: input.finishing,
    engineeringCsApproved: Boolean(input.unitCycle?.engineeringCsApprovedAt),
  };
}
