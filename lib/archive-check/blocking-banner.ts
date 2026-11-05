import type { UnitRequestType } from "@prisma/client";

import type { ArchiveGapStageBlocker } from "@/lib/archive-check/stage-blocking";
import type { UnitRequestStageBlocker } from "@/lib/unit-cycle/stage-request-blocking";

export type UnitCycleBlockerBannerEntry = {
  requestId: string;
  type: UnitRequestType;
  gapItemKeys: string[];
};

export function mergeUnitCycleBlockerBanner(input: {
  openRequests: UnitRequestStageBlocker[];
  openGapTasks: ArchiveGapStageBlocker[];
}): UnitCycleBlockerBannerEntry[] {
  const byId = new Map<string, UnitCycleBlockerBannerEntry>();

  for (const request of input.openRequests) {
    byId.set(request.id, {
      requestId: request.id,
      type: request.type,
      gapItemKeys: [],
    });
  }

  for (const gap of input.openGapTasks) {
    const existing = byId.get(gap.unitRequestId);
    if (existing) {
      existing.gapItemKeys.push(gap.itemKey);
      continue;
    }
    byId.set(gap.unitRequestId, {
      requestId: gap.unitRequestId,
      type: "ARCHIVE_CHECK",
      gapItemKeys: [gap.itemKey],
    });
  }

  return [...byId.values()].map((entry) => ({
    ...entry,
    gapItemKeys: [...new Set(entry.gapItemKeys)].sort(),
  }));
}
