"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { OperationsProgressUnitRow } from "@/lib/operations/load-operations-units";
import {
  buildOperationsFilterUrl,
  resolveOperationsProjectFilterParam,
  type OperationsPageFilters,
} from "@/lib/operations/operations-filter-url";
import {
  isOperationsItemIncomplete,
  OPERATIONS_PROGRESS_ITEM_KEYS,
  type OperationsProgressItemKey,
} from "@/lib/operations/operations-progress";
import { projectNameToSlug } from "@/lib/cases/cases-filter-url";
import { matchesOperationsHandoverFilter } from "@/lib/operations/operations-filter-url";
import { UNASSIGNED_AGENT_FILTER } from "@/lib/filters";
import { OperationsProgressBar } from "@/components/operations/operations-progress-bar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RemovableFilterChip } from "@/components/filters/removable-filter-chip";
import type { UnitsHandoverGroup } from "@/lib/units/units-filter-url";

const HANDOVER_OPTIONS: UnitsHandoverGroup[] = [
  "all",
  "delivered",
  "atRisk",
  "legal",
];

export function OperationsUnitsTable({
  rows,
  filters,
  projectNames,
  agents,
}: {
  rows: OperationsProgressUnitRow[];
  filters: OperationsPageFilters;
  projectNames: string[];
  agents: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("operations");
  const tItems = useTranslations("operations.items");
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);

  const resolvedProject = resolveOperationsProjectFilterParam(
    filters.project,
    projectNames
  );

  const filtered = useMemo(() => {
    const q = (search || filters.q).trim().toLowerCase();
    return rows
      .filter((row) => {
        if (resolvedProject !== "all" && row.projectSlug !== resolvedProject) {
          return false;
        }
        if (
          !matchesOperationsHandoverFilter(row.handoverStatus, filters.handover)
        ) {
          return false;
        }
        if (filters.agent === UNASSIGNED_AGENT_FILTER && row.agentId) {
          return false;
        }
        if (
          filters.agent !== "all" &&
          filters.agent !== UNASSIGNED_AGENT_FILTER &&
          row.agentId !== filters.agent
        ) {
          return false;
        }
        if (filters.missingItem !== "all") {
          const item = row.progress.items.find((i) => i.key === filters.missingItem);
          if (!item || !isOperationsItemIncomplete(item.status)) return false;
        }
        if (q && !row.searchText.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const ratioA =
          a.progress.applicableCount === 0
            ? 1
            : a.progress.doneCount / a.progress.applicableCount;
        const ratioB =
          b.progress.applicableCount === 0
            ? 1
            : b.progress.doneCount / b.progress.applicableCount;
        if (ratioA !== ratioB) return ratioA - ratioB;
        return a.unitCode.localeCompare(b.unitCode);
      });
  }, [rows, resolvedProject, filters, search]);

  function pushFilters(next: Partial<OperationsPageFilters>) {
    const merged = { ...filters, ...next };
    router.push(
      buildOperationsFilterUrl({
        project: merged.project !== "all" ? merged.project : undefined,
        handover: merged.handover !== "all" ? merged.handover : undefined,
        missingItem:
          merged.missingItem !== "all"
            ? (merged.missingItem as OperationsProgressItemKey)
            : undefined,
        agent: merged.agent !== "all" ? merged.agent : undefined,
        q: merged.q || undefined,
      })
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t("search")}</label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") pushFilters({ q: search });
            }}
            placeholder={t("searchPlaceholder")}
          />
        </div>
        <FilterSelect
          label={t("filters.project")}
          value={resolvedProject}
          onValueChange={(project) => pushFilters({ project })}
          options={[
            { value: "all", label: t("filters.allProjects") },
            ...projectNames.map((name) => ({
              value: projectNameToSlug(name),
              label: name,
            })),
          ]}
        />
        <FilterSelect
          label={t("filters.handover")}
          value={filters.handover}
          onValueChange={(handover) =>
            pushFilters({ handover: handover as UnitsHandoverGroup })
          }
          options={HANDOVER_OPTIONS.map((value) => ({
            value,
            label: t(`filters.handoverGroup.${value}`),
          }))}
        />
        <FilterSelect
          label={t("filters.missingItem")}
          value={filters.missingItem}
          onValueChange={(missingItem) =>
            pushFilters({
              missingItem: missingItem as OperationsPageFilters["missingItem"],
            })
          }
          options={[
            { value: "all", label: t("filters.anyItem") },
            ...OPERATIONS_PROGRESS_ITEM_KEYS.map((key) => ({
              value: key,
              label: tItems(key),
            })),
          ]}
        />
        <FilterSelect
          label={t("filters.agent")}
          value={filters.agent}
          onValueChange={(agent) => pushFilters({ agent })}
          options={[
            { value: "all", label: t("filters.allAgents") },
            { value: UNASSIGNED_AGENT_FILTER, label: t("filters.unassigned") },
            ...agents.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.q ? (
          <RemovableFilterChip
            label={t("filters.searchChip", { q: filters.q })}
            onRemove={() => {
              setSearch("");
              pushFilters({ q: "" });
            }}
          />
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.project")}</TableHead>
              <TableHead>{t("table.unit")}</TableHead>
              <TableHead>{t("table.client")}</TableHead>
              <TableHead>{t("table.agent")}</TableHead>
              <TableHead>{t("table.progress")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.project}</TableCell>
                <TableCell>
                  <Link
                    href={`/operations/units/${row.id}`}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {row.unitCode}
                  </Link>
                </TableCell>
                <TableCell>{row.clientName}</TableCell>
                <TableCell>{row.agentName ?? t("table.unassigned")}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm tabular-nums">
                      {t("progressLabel", {
                        done: row.progress.doneCount,
                        total: row.progress.applicableCount,
                      })}
                    </span>
                    <OperationsProgressBar
                      doneCount={row.progress.doneCount}
                      applicableCount={row.progress.applicableCount}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex min-w-[10rem] flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select
        value={value}
        onValueChange={(next) => onValueChange(next ?? "")}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
