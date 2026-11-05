import type { UnitCycleStageKey } from "@prisma/client";

import type { OverdueStageRow } from "@/lib/unit-cycle/queries";

export function groupOverdueStagesForDigest(rows: OverdueStageRow[]): Array<{
  projectId: string;
  projectName: string;
  stageKey: UnitCycleStageKey;
  unitCount: number;
  rows: OverdueStageRow[];
}> {
  const groups = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      stageKey: UnitCycleStageKey;
      rows: OverdueStageRow[];
    }
  >();

  for (const row of rows) {
    const key = `${row.projectId}:${row.stageKey}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(key, {
        projectId: row.projectId,
        projectName: row.projectName,
        stageKey: row.stageKey as UnitCycleStageKey,
        rows: [row],
      });
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      unitCount: group.rows.length,
    }))
    .sort((a, b) => {
      if (a.projectName !== b.projectName) {
        return a.projectName.localeCompare(b.projectName);
      }
      return a.stageKey.localeCompare(b.stageKey);
    });
}

export function groupOverdueStagesForOwnerDigest(rows: OverdueStageRow[]): Array<{
  userId: string;
  rows: OverdueStageRow[];
}> {
  const byUser = new Map<string, OverdueStageRow[]>();
  for (const row of rows) {
    if (!row.assigneeUserId) continue;
    const list = byUser.get(row.assigneeUserId) ?? [];
    list.push(row);
    byUser.set(row.assigneeUserId, list);
  }
  return [...byUser.entries()].map(([userId, userRows]) => ({
    userId,
    rows: userRows,
  }));
}
