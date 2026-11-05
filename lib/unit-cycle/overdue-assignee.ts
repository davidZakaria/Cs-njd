import type { UnitCycleStageKey } from "@prisma/client";

import { resolveUnitCycleAssigneeUserId } from "@/lib/work/personal-scope";

export function resolveOverdueOwnerAssigneeName(input: {
  stageKey: UnitCycleStageKey;
  assignedUserId: string | null;
  assignedUserName: string | null;
  unitAgentId: string | null;
  unitAgentName: string | null;
}): string | null {
  if (input.assignedUserId && input.assignedUserName) {
    return input.assignedUserName;
  }

  const effectiveAssignee = resolveUnitCycleAssigneeUserId({
    stageKey: input.stageKey,
    assignedUserId: input.assignedUserId,
    unitAgentId: input.unitAgentId,
  });

  if (
    effectiveAssignee &&
    input.stageKey === "ENGINEERING" &&
    effectiveAssignee === input.unitAgentId
  ) {
    return input.unitAgentName;
  }

  return null;
}
