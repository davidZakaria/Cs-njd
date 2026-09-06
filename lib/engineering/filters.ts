import type { FinishingPhase } from "@prisma/client";

import {
  hasTrackedFinishingWork,
  isFinishingWorkComplete,
} from "@/lib/finishing/phases";

import type { EngineeringQueueUnit } from "@/lib/engineering/queue";

export type EngineeringProgressFilter =
  | "all"
  | "customMods"
  | "notStarted"
  | "inProgress"
  | "checklistComplete";

export type EngineeringSortKey = "unitCodeAsc" | "unitCodeDesc" | "projectAsc";

export type EngineeringQueueFilters = {
  query: string;
  project: string;
  progress: EngineeringProgressFilter;
  sort: EngineeringSortKey;
};

export const ENGINEERING_PROGRESS_FILTERS: EngineeringProgressFilter[] = [
  "all",
  "customMods",
  "notStarted",
  "inProgress",
  "checklistComplete",
];

export const ENGINEERING_SORT_KEYS: EngineeringSortKey[] = [
  "unitCodeAsc",
  "unitCodeDesc",
  "projectAsc",
];

export function hasCustomModifications(
  value: string | null | undefined
): boolean {
  return Boolean(String(value ?? "").trim());
}

export function matchesEngineeringProgressFilter(
  task: Pick<EngineeringQueueUnit, "customModifications" | "phases">,
  progress: EngineeringProgressFilter
): boolean {
  if (progress === "all") return true;
  if (progress === "customMods") {
    return hasCustomModifications(task.customModifications);
  }
  if (progress === "notStarted") {
    return !hasTrackedFinishingWork(task.phases);
  }
  if (progress === "inProgress") {
    return (
      hasTrackedFinishingWork(task.phases) &&
      !isFinishingWorkComplete(task.phases)
    );
  }
  return isFinishingWorkComplete(task.phases);
}

export function filterEngineeringQueue(
  tasks: EngineeringQueueUnit[],
  filters: EngineeringQueueFilters,
  projectLabelFor: (projectName: string) => string
): EngineeringQueueUnit[] {
  const query = filters.query.trim().toLowerCase();

  const filtered = tasks.filter((task) => {
    if (filters.project !== "all" && task.projectName !== filters.project) {
      return false;
    }

    if (!matchesEngineeringProgressFilter(task, filters.progress)) {
      return false;
    }

    if (!query) return true;

    const projectLabel = projectLabelFor(task.projectName).toLowerCase();
    return (
      task.unitCode.toLowerCase().includes(query) ||
      task.projectName.toLowerCase().includes(query) ||
      projectLabel.includes(query)
    );
  });

  return sortEngineeringQueue(filtered, filters.sort, projectLabelFor);
}

export function sortEngineeringQueue(
  tasks: EngineeringQueueUnit[],
  sort: EngineeringSortKey,
  projectLabelFor: (projectName: string) => string
): EngineeringQueueUnit[] {
  const copy = [...tasks];

  copy.sort((a, b) => {
    if (sort === "unitCodeDesc") {
      return b.unitCode.localeCompare(a.unitCode, undefined, { numeric: true });
    }
    if (sort === "projectAsc") {
      const projectCompare = projectLabelFor(a.projectName).localeCompare(
        projectLabelFor(b.projectName)
      );
      if (projectCompare !== 0) return projectCompare;
      return a.unitCode.localeCompare(b.unitCode, undefined, { numeric: true });
    }
    return a.unitCode.localeCompare(b.unitCode, undefined, { numeric: true });
  });

  return copy;
}

export function countEngineeringProgress(
  tasks: EngineeringQueueUnit[]
): Record<EngineeringProgressFilter, number> {
  return {
    all: tasks.length,
    customMods: tasks.filter((task) =>
      hasCustomModifications(task.customModifications)
    ).length,
    notStarted: tasks.filter(
      (task) => !hasTrackedFinishingWork(task.phases)
    ).length,
    inProgress: tasks.filter(
      (task) =>
        hasTrackedFinishingWork(task.phases) &&
        !isFinishingWorkComplete(task.phases)
    ).length,
    checklistComplete: tasks.filter((task) =>
      isFinishingWorkComplete(task.phases)
    ).length,
  };
}

export function uniqueEngineeringProjects(
  tasks: EngineeringQueueUnit[]
): string[] {
  return [...new Set(tasks.map((task) => task.projectName))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function isEngineeringFiltersActive(
  filters: EngineeringQueueFilters
): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.project !== "all" ||
    filters.progress !== "all" ||
    filters.sort !== "unitCodeAsc"
  );
}