import type { Role, UnitCycleStageKey } from "@prisma/client";

import type { OverdueStageRow } from "@/lib/unit-cycle/queries";
import { unitCycleStageLabelEnAr } from "@/lib/unit-cycle/stage-labels";
import { departmentRolesWithClaimPool } from "@/lib/work/personal-scope";

export function summarizeOverdueRowsByStage(
  rows: OverdueStageRow[]
): Array<{ stageKey: UnitCycleStageKey; count: number }> {
  const counts = new Map<UnitCycleStageKey, number>();
  for (const row of rows) {
    const key = row.stageKey as UnitCycleStageKey;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([stageKey, count]) => ({ stageKey, count }))
    .sort((a, b) => a.stageKey.localeCompare(b.stageKey));
}

export function formatOverdueDigestMessage(
  rows: OverdueStageRow[]
): { en: string; ar: string } {
  const total = rows.length;
  if (total === 0) {
    return { en: "No overdue unit cycle tasks", ar: "لا مهام دورة متأخرة" };
  }

  const byStage = summarizeOverdueRowsByStage(rows);
  const enParts = byStage.map(({ stageKey, count }) => {
    const label = unitCycleStageLabelEnAr(stageKey).en;
    return `${count} in ${label}`;
  });
  const arParts = byStage.map(({ stageKey, count }) => {
    const label = unitCycleStageLabelEnAr(stageKey).ar;
    return `${count} في ${label}`;
  });

  return {
    en: `${total} unit(s) overdue: ${enParts.join(", ")}`,
    ar: `${total} وحدة متأخرة: ${arParts.join("، ")}`,
  };
}

export function groupOverdueStagesForDepartmentPoolDigest(
  rows: OverdueStageRow[]
): Array<{ ownerRole: Role; rows: OverdueStageRow[] }> {
  const poolRoles = new Set<Role>(departmentRolesWithClaimPool());
  const byRole = new Map<Role, OverdueStageRow[]>();

  for (const row of rows) {
    if (row.assigneeUserId) continue;
    if (!poolRoles.has(row.ownerRole)) continue;
    const list = byRole.get(row.ownerRole) ?? [];
    list.push(row);
    byRole.set(row.ownerRole, list);
  }

  return [...byRole.entries()].map(([ownerRole, roleRows]) => ({
    ownerRole,
    rows: roleRows,
  }));
}

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
