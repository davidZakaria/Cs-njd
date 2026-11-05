"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";

import { RemovableFilterChip } from "@/components/filters/removable-filter-chip";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  selectOptionItems,
  selectOptionLabel,
} from "@/lib/ui/select-option-label";
import {
  buildOverdueTasksPageUrl,
  DEPARTMENT_ROLES,
  STAGE_KEYS,
  type OverdueTasksPageFilters,
  projectNameToSlug,
} from "@/lib/unit-cycle/overdue-filter-url";
import {
  filterOverdueStageRows,
  groupOverdueStageRows,
  type OverdueStageRow,
} from "@/lib/unit-cycle/queries";
import type { Role, UnitCycleStageKey } from "@prisma/client";
import { cn } from "@/lib/utils";

export function OverdueTasksWorkspace({
  rows,
  projects,
  initialFilters,
}: {
  rows: OverdueStageRow[];
  projects: Array<{ id: string; name: string }>;
  initialFilters: OverdueTasksPageFilters;
}) {
  const t = useTranslations("unitCycle.overdueManagement");
  const tStages = useTranslations("unitCycle.stages");
  const tDepartments = useTranslations("unitCycle.ownerDepartments");
  const locale = useLocale();
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);

  const syncUrl = (next: OverdueTasksPageFilters) => {
    setFilters(next);
    router.replace(
      buildOverdueTasksPageUrl({
        project: next.project !== "all" ? next.project : undefined,
        stage: next.stage !== "all" ? next.stage : undefined,
        department: next.department !== "all" ? next.department : undefined,
        minDays: next.minDays !== "all" ? next.minDays : undefined,
      })
    );
  };

  const filtered = useMemo(
    () => filterOverdueStageRows(rows, filters),
    [rows, filters]
  );

  const grouped = useMemo(() => groupOverdueStageRows(filtered), [filtered]);

  const projectOptions = useMemo(
    () => [
      { value: "all", label: t("filters.allProjects") },
      ...projects.map((project) => ({
        value: projectNameToSlug(project.name),
        label: project.name,
      })),
    ],
    [projects, t]
  );

  const stageOptions = useMemo(
    () => [
      { value: "all", label: t("filters.allStages") },
      ...STAGE_KEYS.map((stageKey) => ({
        value: stageKey,
        label: tStages(stageKey),
      })),
    ],
    [t, tStages]
  );

  const departmentOptions = useMemo(
    () => [
      { value: "all", label: t("filters.allDepartments") },
      ...DEPARTMENT_ROLES.map((role) => ({
        value: role,
        label: tDepartments(role),
      })),
    ],
    [t, tDepartments]
  );

  const minDaysOptions = useMemo(
    () => [
      { value: "all", label: t("filters.anyDaysOverdue") },
      { value: "1", label: t("filters.atLeastDays", { days: 1 }) },
      { value: "3", label: t("filters.atLeastDays", { days: 3 }) },
      { value: "7", label: t("filters.atLeastDays", { days: 7 }) },
      { value: "14", label: t("filters.atLeastDays", { days: 14 }) },
    ],
    [t]
  );

  const chips = useMemo(() => {
    const list: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (filters.project !== "all") {
      list.push({
        key: "project",
        label: filters.project,
        onRemove: () => syncUrl({ ...filters, project: "all" }),
      });
    }
    if (filters.stage !== "all") {
      list.push({
        key: "stage",
        label: tStages(filters.stage),
        onRemove: () => syncUrl({ ...filters, stage: "all" }),
      });
    }
    if (filters.department !== "all") {
      list.push({
        key: "department",
        label: tDepartments(filters.department),
        onRemove: () => syncUrl({ ...filters, department: "all" }),
      });
    }
    if (filters.minDays !== "all") {
      list.push({
        key: "minDays",
        label: t("filters.minDaysChip", { days: filters.minDays }),
        onRemove: () => syncUrl({ ...filters, minDays: "all" }),
      });
    }
    return list;
  }, [filters, t, tStages, tDepartments]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select
          value={filters.project}
          items={selectOptionItems(projectOptions)}
          onValueChange={(value) => {
            if (value == null) return;
            syncUrl({ ...filters, project: value });
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue>{selectOptionLabel(projectOptions, filters.project)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allProjects")}</SelectItem>
            {projects.map((project) => (
              <SelectItem
                key={project.id}
                value={projectNameToSlug(project.name)}
              >
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.stage}
          items={selectOptionItems(stageOptions)}
          onValueChange={(value) => {
            if (value == null) return;
            syncUrl({
              ...filters,
              stage: value as OverdueTasksPageFilters["stage"],
            });
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue>{selectOptionLabel(stageOptions, filters.stage)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allStages")}</SelectItem>
            {STAGE_KEYS.map((stageKey) => (
              <SelectItem key={stageKey} value={stageKey}>
                {tStages(stageKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.department}
          items={selectOptionItems(departmentOptions)}
          onValueChange={(value) => {
            if (value == null) return;
            syncUrl({
              ...filters,
              department: value as OverdueTasksPageFilters["department"],
            });
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue>
              {selectOptionLabel(departmentOptions, filters.department)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allDepartments")}</SelectItem>
            {DEPARTMENT_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {tDepartments(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.minDays}
          items={selectOptionItems(minDaysOptions)}
          onValueChange={(value) => {
            if (value == null) return;
            syncUrl({
              ...filters,
              minDays: value as OverdueTasksPageFilters["minDays"],
            });
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue>{selectOptionLabel(minDaysOptions, filters.minDays)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.anyDaysOverdue")}</SelectItem>
            <SelectItem value="1">{t("filters.atLeastDays", { days: 1 })}</SelectItem>
            <SelectItem value="3">{t("filters.atLeastDays", { days: 3 })}</SelectItem>
            <SelectItem value="7">{t("filters.atLeastDays", { days: 7 })}</SelectItem>
            <SelectItem value="14">{t("filters.atLeastDays", { days: 14 })}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <RemovableFilterChip
              key={chip.key}
              label={chip.label}
              onRemove={chip.onRemove}
            />
          ))}
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {t("resultsCount", { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-lg border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          {t("emptyFiltered")}
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((stageGroup) => (
            <section key={stageGroup.stageKey} className="space-y-3">
              <h2 className="font-heading text-lg font-semibold">
                {tStages(stageGroup.stageKey as UnitCycleStageKey)}
              </h2>
              {stageGroup.owners.map((ownerGroup) => (
                <div
                  key={`${stageGroup.stageKey}-${ownerGroup.ownerRole}-${ownerGroup.ownerAssigneeName ?? ""}`}
                  className="space-y-2 rounded-xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5"
                >
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("ownerGroupLabel", {
                      department: tDepartments(ownerGroup.ownerRole),
                      assignee:
                        ownerGroup.ownerAssigneeName ?? t("ownerUnclaimed"),
                    })}
                  </p>
                  <ul className="space-y-2">
                    {ownerGroup.tasks.map((task) => (
                      <li
                        key={`${task.unitId}-${task.stageKey}`}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3"
                        )}
                      >
                        <div>
                          <p className="font-medium">
                            {task.projectName} · {task.unitCode}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t("taskMeta", {
                              days: task.daysOverdue,
                              checklist: `${task.checklistPassed}/${task.checklistTotal}`,
                            })}
                          </p>
                          {task.deadlineAt ? (
                            <p className="text-xs text-muted-foreground">
                              {t("deadline", {
                                date: new Date(task.deadlineAt).toLocaleDateString(
                                  locale
                                ),
                              })}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="destructive">
                            {t("daysOverdueBadge", { days: task.daysOverdue })}
                          </Badge>
                          <Link
                            href={`/units/${task.unitId}`}
                            className={buttonVariants({ size: "sm", variant: "default" })}
                          >
                            {t("actions.openUnit")}
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
