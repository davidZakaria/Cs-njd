"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  countEngineeringProgress,
  ENGINEERING_PROGRESS_FILTERS,
  ENGINEERING_SORT_KEYS,
  filterEngineeringQueue,
  isEngineeringFiltersActive,
  uniqueEngineeringProjects,
  type EngineeringProgressFilter,
  type EngineeringQueueFilters,
  type EngineeringSortKey,
} from "@/lib/engineering/filters";
import type { EngineeringQueueUnit } from "@/lib/engineering/queue";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DEFAULT_FILTERS: EngineeringQueueFilters = {
  query: "",
  project: "all",
  progress: "all",
  sort: "unitCodeAsc",
};

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className={cn(
        "h-9 shrink-0 rounded-full px-3.5 text-sm",
        active && "shadow-sm"
      )}
      onClick={onClick}
    >
      {label}
      {typeof count === "number" ? (
        <span
          className={cn(
            "ms-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums",
            active
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      ) : null}
    </Button>
  );
}

export function EngineeringQueuePanel({
  tasks,
}: {
  tasks: EngineeringQueueUnit[];
}) {
  const t = useTranslations("engineering");
  const tCommon = useTranslations("common");
  const labels = useDomainLabels();
  const [filters, setFilters] = useState<EngineeringQueueFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const projectLabelFor = labels.project;
  const progressCounts = useMemo(
    () => countEngineeringProgress(tasks),
    [tasks]
  );
  const projects = useMemo(() => uniqueEngineeringProjects(tasks), [tasks]);

  const filteredTasks = useMemo(
    () => filterEngineeringQueue(tasks, filters, projectLabelFor),
    [tasks, filters, projectLabelFor]
  );

  const sortItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const key of ENGINEERING_SORT_KEYS) {
      items[key] = t(`filters.sort.${key}`);
    }
    return items;
  }, [t]);

  const progressLabel = (key: EngineeringProgressFilter) =>
    t(`filters.progress.${key}`);

  const filtersActive = isEngineeringFiltersActive(filters);

  function setProgress(progress: EngineeringProgressFilter) {
    setFilters((current) => ({ ...current, progress }));
  }

  function setProject(project: string) {
    setFilters((current) => ({ ...current, project }));
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              <CardTitle className="text-base">{t("filters.title")}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="tabular-nums">
                {t("filters.showing", {
                  count: filteredTasks.length,
                  total: tasks.length,
                })}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                {filtersOpen ? t("filters.hide") : t("filters.show")}
              </Button>
            </div>
          </div>

          {filtersOpen ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.query}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      query: event.target.value,
                    }))
                  }
                  placeholder={t("filters.searchPlaceholder")}
                  className="h-11 ps-9 text-base"
                  inputMode="search"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("filters.progressLabel")}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {ENGINEERING_PROGRESS_FILTERS.map((key) => (
                    <FilterChip
                      key={key}
                      active={filters.progress === key}
                      label={progressLabel(key)}
                      count={progressCounts[key]}
                      onClick={() => setProgress(key)}
                    />
                  ))}
                </div>
              </div>

              {projects.length > 1 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("filters.projectLabel")}
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <FilterChip
                      active={filters.project === "all"}
                      label={tCommon("all")}
                      count={tasks.length}
                      onClick={() => setProject("all")}
                    />
                    {projects.map((projectName) => {
                      const count = tasks.filter(
                        (task) => task.projectName === projectName
                      ).length;
                      return (
                        <FilterChip
                          key={projectName}
                          active={filters.project === projectName}
                          label={projectLabelFor(projectName)}
                          count={count}
                          onClick={() => setProject(projectName)}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={filters.sort}
                  onValueChange={(value) => {
                    if (value) {
                      setFilters((current) => ({
                        ...current,
                        sort: value as EngineeringSortKey,
                      }));
                    }
                  }}
                  items={sortItems}
                >
                  <SelectTrigger className="h-10 w-full sm:w-[14rem]">
                    <SelectValue placeholder={t("filters.sortLabel")} />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGINEERING_SORT_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {t(`filters.sort.${key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {filtersActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 gap-1.5"
                    onClick={clearFilters}
                  >
                    <X className="size-3.5" />
                    {t("filters.clear")}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardHeader>
      </Card>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("noTasks")}
          </CardContent>
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <p className="text-muted-foreground">{t("filters.noMatches")}</p>
            <Button type="button" variant="outline" onClick={clearFilters}>
              {t("filters.clear")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {filteredTasks.map((task) => {
            const projectLabel = projectLabelFor(task.projectName);
            const hasMods = Boolean(
              String(task.customModifications ?? "").trim()
            );

            return (
              <li key={task.id}>
                <Card className="overflow-hidden shadow-premium transition-shadow hover:shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-xl">{task.unitCode}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {projectLabel}
                        </p>
                      </div>
                      {hasMods ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-300/70 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                        >
                          {t("filters.modBadge")}
                        </Badge>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {hasMods ? (
                      <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-950/30">
                        <p className="font-medium text-amber-900 dark:text-amber-100">
                          {t("customModifications")}
                        </p>
                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-amber-950 dark:text-amber-50">
                          {task.customModifications}
                        </p>
                      </div>
                    ) : null}
                    {task.phases.some((phase) => phase !== "NOT_STARTED") ? (
                      <div className="flex flex-wrap gap-1.5">
                        {task.phases.map((phase) => (
                          <Badge key={phase} variant="secondary">
                            {labels.finishingPhase(phase)}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <Button
                      nativeButton={false}
                      className="h-11 w-full text-base"
                      render={
                        <Link href={`/engineering/units/${task.id}`} />
                      }
                    >
                      {t("updateFinishes")}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
