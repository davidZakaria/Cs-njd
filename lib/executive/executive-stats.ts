import type { ExecutiveCaseRow, ResolvedStats } from "@/lib/cases/executive-dashboard";

export function countUniqueUnits(
  rows: ExecutiveCaseRow[],
  predicate?: (row: ExecutiveCaseRow) => boolean
): number {
  const unitIds = new Set<string>();
  for (const row of rows) {
    if (!predicate || predicate(row)) {
      unitIds.add(row.unitId);
    }
  }
  return unitIds.size;
}

export function computeResolvedStats(rows: ExecutiveCaseRow[]): ResolvedStats {
  const myRows = rows.filter((row) => row.isMine);
  const teamRows = rows.filter((row) => !row.isMine);
  return {
    resolvedTotal: countUniqueUnits(rows),
    myResolved: countUniqueUnits(myRows),
    teamResolved: countUniqueUnits(teamRows),
  };
}
