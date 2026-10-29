import type {
  OperationsProgressItemKey,
  OperationsProgressSummary,
} from "@/lib/operations/operations-progress";
import { OPERATIONS_PROGRESS_ITEM_KEYS } from "@/lib/operations/operations-progress";

export type OperationsProjectSummaryRow = {
  project: string;
  projectSlug: string;
  unitCount: number;
  percentComplete: number;
  totalDoneCount: number;
  totalApplicableCount: number;
  averageDoneCount: number;
  averageApplicableCount: number;
  missingCounts: Record<OperationsProgressItemKey, number>;
};

export function aggregateOperationsProjectSummaries(
  rows: Array<{
    project: string;
    projectSlug: string;
    progress: OperationsProgressSummary;
  }>
): OperationsProjectSummaryRow[] {
  const byProject = new Map<
    string,
    {
      project: string;
      projectSlug: string;
      units: OperationsProgressSummary[];
    }
  >();

  for (const row of rows) {
    const existing = byProject.get(row.project);
    if (existing) {
      existing.units.push(row.progress);
    } else {
      byProject.set(row.project, {
        project: row.project,
        projectSlug: row.projectSlug,
        units: [row.progress],
      });
    }
  }

  return [...byProject.values()]
    .map(({ project, projectSlug, units }) => {
      const unitCount = units.length;
      const totalPercent = units.reduce((acc, u) => acc + u.percentComplete, 0);
      const totalDone = units.reduce((acc, u) => acc + u.doneCount, 0);
      const totalApplicable = units.reduce(
        (acc, u) => acc + u.applicableCount,
        0
      );

      const missingCounts = Object.fromEntries(
        OPERATIONS_PROGRESS_ITEM_KEYS.map((key) => [key, 0])
      ) as Record<OperationsProgressItemKey, number>;

      for (const unit of units) {
        for (const item of unit.items) {
          if (item.status === "missing" || item.status === "needs_update") {
            missingCounts[item.key] += 1;
          }
        }
      }

      return {
        project,
        projectSlug,
        unitCount,
        percentComplete:
          unitCount === 0 ? 0 : Math.round(totalPercent / unitCount),
        totalDoneCount: totalDone,
        totalApplicableCount: totalApplicable,
        averageDoneCount: unitCount === 0 ? 0 : totalDone / unitCount,
        averageApplicableCount:
          unitCount === 0 ? 0 : totalApplicable / unitCount,
        missingCounts,
      };
    })
    .sort((a, b) => a.percentComplete - b.percentComplete);
}
