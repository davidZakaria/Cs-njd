"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search } from "lucide-react";

import type { PendingWorkUnit } from "@/lib/cases/pending-work";
import { PendingCaseCard } from "@/components/cases/pending-case-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE = 5;
const PAGE_SIZE = 10;

export type PendingWorkProjectGroup = {
  projectKey: string;
  projectLabel: string;
  unitCount: number;
  openCaseCount: number;
  items: PendingWorkUnit[];
};

export function CsPendingWorkDashboard({
  groups,
}: {
  groups: PendingWorkProjectGroup[];
}) {
  const t = useTranslations("cases.pendingWork");
  const [activeProject, setActiveProject] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(groups[0] ? [groups[0].projectKey] : [])
  );
  const [visibleByProject, setVisibleByProject] = useState<Record<string, number>>(
    {}
  );

  const totals = useMemo(() => {
    const units = groups.reduce((sum, group) => sum + group.unitCount, 0);
    return { units, projects: groups.length };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return groups
      .filter(
        (group) => activeProject === "all" || group.projectKey === activeProject
      )
      .map((group) => {
        if (!normalizedQuery) return group;

        const items = group.items.filter((item) => {
          const haystack = [
            item.clientName,
            item.unitCode,
            item.primaryTicket.notes,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalizedQuery);
        });

        return {
          ...group,
          items,
          unitCount: items.length,
          openCaseCount: items.length,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [activeProject, groups, query]);

  function toggleProject(projectKey: string) {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(projectKey)) next.delete(projectKey);
      else next.add(projectKey);
      return next;
    });
  }

  function showMore(projectKey: string, total: number) {
    setVisibleByProject((current) => ({
      ...current,
      [projectKey]: Math.min(
        (current[projectKey] ?? INITIAL_VISIBLE) + PAGE_SIZE,
        total
      ),
    }));
  }

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-muted/20 px-4 py-3">
        <p className="text-sm font-medium">{t("summaryLine", totals)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("summaryHint")}</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="ps-9"
          aria-label={t("searchPlaceholder")}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={activeProject === "all" ? "default" : "outline"}
          onClick={() => setActiveProject("all")}
        >
          {t("filterAll")}
          <Badge variant="secondary" className="ms-2 tabular-nums">
            {totals.units}
          </Badge>
        </Button>
        {groups.map((group) => (
          <Button
            key={group.projectKey}
            type="button"
            size="sm"
            variant={
              activeProject === group.projectKey ? "default" : "outline"
            }
            onClick={() => {
              setActiveProject(group.projectKey);
              setExpandedProjects((current) => new Set(current).add(group.projectKey));
            }}
          >
            {group.projectLabel}
            <Badge variant="secondary" className="ms-2 tabular-nums">
              {group.unitCount}
            </Badge>
          </Button>
        ))}
      </div>

      {filteredGroups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("noSearchResults")}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isOpen =
              activeProject !== "all" || expandedProjects.has(group.projectKey);
            const visibleLimit =
              visibleByProject[group.projectKey] ?? INITIAL_VISIBLE;
            const visibleItems = group.items.slice(0, visibleLimit);
            const hiddenCount = group.items.length - visibleItems.length;

            return (
              <section
                key={group.projectKey}
                className="overflow-hidden rounded-xl border bg-card/50 shadow-sm"
              >
                {activeProject === "all" ? (
                  <button
                    type="button"
                    onClick={() => toggleProject(group.projectKey)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{group.projectLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("projectSummary", { units: group.unitCount })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">
                        {t("projectUnitCount", { count: group.unitCount })}
                      </Badge>
                      <ChevronDown
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          isOpen && "rotate-180"
                        )}
                      />
                    </div>
                  </button>
                ) : (
                  <div className="border-b px-4 py-3">
                    <p className="font-semibold">{group.projectLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("projectSummary", { units: group.unitCount })}
                    </p>
                  </div>
                )}

                {isOpen ? (
                  <div className="space-y-2 border-t bg-background/40 p-3">
                    {visibleItems.map((item) => (
                      <PendingCaseCard
                        key={item.unitId}
                        compact
                        hideContextMeta
                        unitId={item.unitId}
                        unitCode={item.unitCode}
                        project={item.project}
                        clientName={item.clientName}
                        clientPhone={item.clientPhone}
                        unitAgent={item.unitAgent}
                        openCount={item.openCount}
                        ticketId={item.primaryTicket.id}
                        ticketAgentId={item.primaryTicket.agentId}
                        ticketAgentName={item.primaryTicket.agentName}
                        notes={item.primaryTicket.notes}
                        category={item.primaryTicket.category}
                        status={item.primaryTicket.status}
                        workflowKey={item.primaryTicket.workflowKey}
                      />
                    ))}
                    {hiddenCount > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          showMore(group.projectKey, group.items.length)
                        }
                      >
                        {t("showMore", { count: hiddenCount })}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
