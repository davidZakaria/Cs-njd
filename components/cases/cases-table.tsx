"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RemovableFilterChip } from "@/components/filters/removable-filter-chip";
import { formatDateTime } from "@/lib/format/datetime";
import { formatLocaleInteger } from "@/lib/format/locale-display";
import { Link, useRouter } from "@/i18n/navigation";
import { updateTicketStatus } from "@/lib/actions/crm";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { isAwaitingResponseNote } from "@/lib/import/master-cases";
import { OPEN_TICKET_STATUSES } from "@/lib/cases/workflow";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { TicketAgentAssignForm } from "@/components/cases/ticket-agent-assign-form";
import {
  isUnassignedAgentName,
  UNASSIGNED_AGENT_FILTER,
} from "@/lib/filters";
import {
  buildCasesPageUrl,
  isCasesFilterActive,
  type CasesPageFilters,
  projectNameToSlug,
  resolveAgentFilterParam,
} from "@/lib/cases/cases-filter-url";
import { PENDING_PARTY_CHART_KEYS } from "@/lib/executive/chart-theme";
import { filterCaseDashboardRows } from "@/lib/cases/case-dashboard-filters";
import { isFollowUpDue } from "@/lib/cases/follow-up-sprint";
import {
  confirmManagementOverride,
  ManagementOverrideCheckbox,
} from "@/components/workflow/management-override-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import { cn } from "@/lib/utils";
import { UnitDisplayFieldsCompactLine } from "@/components/units/unit-display-fields-compact-line";
import type { SerializableUnitDisplayFields } from "@/lib/units/unit-display-fields";

export type CaseRow = {
  id: string;
  notes: string;
  category: string;
  status: string;
  pendingParty: string;
  nextFollowUpDate: string;
  createdAt: string;
  unitId: string;
  unitCode: string;
  unitDisplayFields?: SerializableUnitDisplayFields;
  project: string;
  client: string;
  agentId: string | null;
  unitAgentId: string | null;
  agent: string;
  effectiveAgentId: string | null;
  effectiveAgent: string;
};

const TICKET_STATUSES = ["PENDING", "ENGINEERING", "LEGAL", "RESOLVED"] as const;
/** Category filter dropdown order — Current Status immediately after “All categories”. */
const DEFAULT_CASES_FILTERS: CasesPageFilters = {
  status: "all",
  project: "all",
  category: "all",
  agent: "all",
  followUp: "all",
  pendingParty: "all",
  distinctUnit: false,
  queue: "all",
  primaryStatus: "all",
  metricCategory: "all",
  awaitingParty: false,
};

const CATEGORY_FILTER_ORDER = [
  "CUSTOMER_SERVICE",
  "FEEDBACK_HISTORY",
  "LEGAL",
  "GENERAL",
] as const;

function categoryFilterRank(category: string) {
  const index = CATEGORY_FILTER_ORDER.indexOf(
    category as (typeof CATEGORY_FILTER_ORDER)[number]
  );
  return index === -1 ? CATEGORY_FILTER_ORDER.length : index;
}

function TicketStatusForm({
  ticketId,
  status,
  statusItems,
  saveLabel,
  canUseManagementOverride,
}: {
  ticketId: string;
  status: string;
  statusItems: Record<string, string>;
  saveLabel: string;
  canUseManagementOverride: boolean;
}) {
  const tWorkflow = useTranslations("workflow");
  const { pending, notify } = useCrudToast();
  const [value, setValue] = useState(status);
  const [override, setOverride] = useState(false);

  async function handleUpdate(formData: FormData) {
    if (
      !confirmManagementOverride(
        value,
        override,
        tWorkflow("override.confirm")
      )
    ) {
      return;
    }
    notify(await updateTicketStatus(formData), "saved");
  }

  return (
    <form action={handleUpdate} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={ticketId} />
      <input type="hidden" name="status" value={value} />
      <div className="flex flex-wrap gap-2">
        <Select
          value={value}
          onValueChange={(next) => {
            if (next != null) {
              setValue(next);
              if (next !== "RESOLVED") setOverride(false);
            }
          }}
          items={statusItems}
        >
          <SelectTrigger className="w-[9.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TICKET_STATUSES.map((ticketStatus) => (
              <SelectItem key={ticketStatus} value={ticketStatus}>
                {statusItems[ticketStatus]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" disabled={pending}>
          {saveLabel}
        </Button>
      </div>
      <ManagementOverrideCheckbox
        visible={canUseManagementOverride && value === "RESOLVED"}
        checked={override}
        onCheckedChange={setOverride}
      />
    </form>
  );
}

const CASE_TABLE_MIN_WIDTH = "min-w-[86.5rem]";

const CASE_COLUMN_CLASS: Record<string, string> = {
  unit: "w-[11rem] min-w-[11rem] max-w-[11rem]",
  client: "w-[9rem] min-w-[9rem] max-w-[9rem]",
  category: "w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem]",
  notes: "w-[16rem] min-w-[16rem] max-w-[16rem]",
  agent: "w-[12rem] min-w-[12rem] max-w-[12rem]",
  status: "w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem]",
  manage: "w-[12rem] min-w-[12rem] max-w-[12rem]",
};

function CaseTableHeaderCell({
  children,
}: {
  children: ReactNode;
}) {
  const title =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : undefined;
  return (
    <div className="truncate px-3 py-2.5" title={title}>
      {children}
    </div>
  );
}

export function CasesTable({
  data,
  agents,
  canAssign,
  canUseManagementOverride = false,
  sectionTitle,
  sectionDescription,
  defaultStatusFilter = "all",
  defaultProjectFilter = "all",
  defaultCategoryFilter = "all",
  defaultAgentFilter = "all",
  defaultFollowUpFilter = "all",
  defaultPendingPartyFilter = "all",
  defaultPageFilters,
  viewerUserId,
  defaultCollapsed = false,
  canExport = true,
}: {
  data: CaseRow[];
  agents: Array<{ id: string; name: string }>;
  canAssign: boolean;
  canUseManagementOverride?: boolean;
  sectionTitle?: string;
  sectionDescription?: string;
  defaultStatusFilter?: "all" | "open" | (typeof TICKET_STATUSES)[number];
  defaultProjectFilter?: string;
  defaultCategoryFilter?: string;
  defaultAgentFilter?: string;
  defaultFollowUpFilter?: "all" | "due";
  defaultPendingPartyFilter?: string;
  /** Full URL filters from the server (includes distinctUnit, queue, etc.). */
  defaultPageFilters?: CasesPageFilters;
  /** Required for `queue=team` drill-down filters. */
  viewerUserId?: string;
  defaultCollapsed?: boolean;
  canExport?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("cases");
  const tCommon = useTranslations("common");
  const tFilters = useTranslations("filters");
  const labels = useDomainLabels();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [query, setQuery] = useState("");
  const resolvedInitialFilters = useMemo((): CasesPageFilters => {
    if (defaultPageFilters) return defaultPageFilters;
    return {
      ...DEFAULT_CASES_FILTERS,
      status: defaultStatusFilter,
      project: defaultProjectFilter,
      category: defaultCategoryFilter,
      agent: defaultAgentFilter,
      followUp: defaultFollowUpFilter,
      pendingParty: defaultPendingPartyFilter,
    };
  }, [
    defaultPageFilters,
    defaultAgentFilter,
    defaultCategoryFilter,
    defaultFollowUpFilter,
    defaultPendingPartyFilter,
    defaultProjectFilter,
    defaultStatusFilter,
  ]);

  const [urlFilters, setUrlFilters] = useState<CasesPageFilters>(
    resolvedInitialFilters
  );

  useEffect(() => {
    setUrlFilters(resolvedInitialFilters);
  }, [resolvedInitialFilters]);

  const pushUrlFilters = useCallback(
    (next: CasesPageFilters) => {
      setUrlFilters(next);
      router.push(buildCasesPageUrl(next));
    },
    [router]
  );

  const statusFilter = urlFilters.status;
  const projectFilter = urlFilters.project;
  const categoryFilter = urlFilters.category;
  const followUpFilter = urlFilters.followUp;
  const pendingPartyFilter = urlFilters.pendingParty;
  const agentFilter = useMemo(() => {
    const resolved = resolveAgentFilterParam(urlFilters.agent, agents);
    return resolved === "unassigned" ? UNASSIGNED_AGENT_FILTER : resolved;
  }, [agents, urlFilters.agent]);

  const statusItems = useMemo(() => {
    const items: Record<string, string> = {
      all: t("allStatuses"),
      open: t("openCases"),
    };
    for (const status of TICKET_STATUSES) {
      items[status] = labels.ticketStatus(status);
    }
    return items;
  }, [labels, t]);

  const categoryItems = useMemo(() => {
    const items: Record<string, string> = { all: t("allCategories") };
    for (const category of CATEGORY_FILTER_ORDER) {
      items[category] = labels.ticketCategory(category);
    }
    return items;
  }, [labels, t]);

  const agentSelectItems = useMemo(
    () => [
      { value: "all", label: t("allAgents") },
      { value: UNASSIGNED_AGENT_FILTER, label: t("unassigned") },
      ...agents.map((agent) => ({
        value: agent.name,
        label: labels.staffName(agent.name),
      })),
    ],
    [agents, labels, t]
  );

  const agentFilterItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const item of agentSelectItems) {
      items[item.value] = item.label;
    }
    return items;
  }, [agentSelectItems]);

  const categoryLabels: Record<string, string> = useMemo(
    () => ({
      CUSTOMER_SERVICE: labels.ticketCategory("CUSTOMER_SERVICE"),
      FEEDBACK_HISTORY: labels.ticketCategory("FEEDBACK_HISTORY"),
      LEGAL: labels.ticketCategory("LEGAL"),
      GENERAL: labels.ticketCategory("GENERAL"),
    }),
    [labels]
  );

  const rowStatusItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const status of TICKET_STATUSES) {
      items[status] = labels.ticketStatus(status);
    }
    return items;
  }, [labels]);

  const projectItems = useMemo(() => {
    const uniqueProjects = [...new Set(data.map((row) => row.project))].sort();
    const items: Record<string, string> = { all: t("allProjects") };
    for (const project of uniqueProjects) {
      items[projectNameToSlug(project)] = labels.project(project);
    }
    return items;
  }, [data, labels, t]);

  const filtered = useMemo(() => {
    const rows = filterCaseDashboardRows(data, urlFilters, {
      viewerUserId,
      agents,
    });

  const searched = !query
      ? rows
      : rows.filter((row) => {
          const q = query.toLowerCase();
          return (
            row.notes.toLowerCase().includes(q) ||
            (row.unitCode ?? "").toLowerCase().includes(q) ||
            (row.client ?? "").toLowerCase().includes(q) ||
            row.project.toLowerCase().includes(q)
          );
        });

    if (categoryFilter !== "all") return searched;

    return [...searched].sort(
      (a, b) => categoryFilterRank(a.category) - categoryFilterRank(b.category)
    );
  }, [data, urlFilters, viewerUserId, agents, categoryFilter, query]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (urlFilters.status !== "all") {
      const statusLabel =
        urlFilters.status === "open"
          ? t("openCases")
          : labels.ticketStatus(urlFilters.status);
      chips.push({
        key: "status",
        label: t("filters.statusLabel", { value: statusLabel }),
        clear: () => pushUrlFilters({ ...urlFilters, status: "all" }),
      });
    }
    if (urlFilters.project !== "all") {
      const name =
        data.find(
          (row) => projectNameToSlug(row.project) === urlFilters.project
        )?.project ?? urlFilters.project;
      chips.push({
        key: "project",
        label: t("filters.projectLabel", { value: name }),
        clear: () => pushUrlFilters({ ...urlFilters, project: "all" }),
      });
    }
    if (urlFilters.category !== "all") {
      chips.push({
        key: "category",
        label: t("filters.categoryLabel", {
          value: labels.ticketCategory(urlFilters.category),
        }),
        clear: () => pushUrlFilters({ ...urlFilters, category: "all" }),
      });
    }
    if (urlFilters.agent !== "all") {
      const agentLabel =
        urlFilters.agent === "unassigned"
          ? t("unassigned")
          : labels.staffName(
              agents.find((a) => a.id === urlFilters.agent)?.name ??
                urlFilters.agent
            );
      chips.push({
        key: "agent",
        label: t("filters.agentLabel", { value: agentLabel }),
        clear: () => pushUrlFilters({ ...urlFilters, agent: "all" }),
      });
    }
    if (urlFilters.followUp === "due") {
      chips.push({
        key: "followUp",
        label: t("filters.followUpLabel"),
        clear: () => pushUrlFilters({ ...urlFilters, followUp: "all" }),
      });
    }
    if (urlFilters.pendingParty !== "all") {
      chips.push({
        key: "pendingParty",
        label: t("filters.pendingPartyLabel", {
          value: labels.pendingParty(urlFilters.pendingParty),
        }),
        clear: () => pushUrlFilters({ ...urlFilters, pendingParty: "all" }),
      });
    }
    return chips;
  }, [agents, data, labels, pushUrlFilters, t, urlFilters]);

  const exportHeaders = useMemo(
    () => [
      t("unit"),
      t("client"),
      t("category"),
      t("caseNotes"),
      t("agent"),
      t("status"),
      t("createdAt"),
    ],
    [t]
  );

  const exportRows = useMemo(
    () =>
      filtered.map((row) => [
        `${labels.project(row.project)} · ${row.unitCode}`,
        row.client,
        categoryLabels[row.category] ?? row.category,
        isAwaitingResponseNote(row.notes)
          ? t("awaitingResponse")
          : row.notes,
        isUnassignedAgentName(row.effectiveAgent)
          ? t("unassigned")
          : labels.staffName(row.effectiveAgent),
        labels.ticketStatus(row.status),
        formatDateTime(row.createdAt, locale),
      ]),
    [filtered, labels, categoryLabels, locale, t]
  );

  const columns = useMemo<ColumnDef<CaseRow>[]>(() => {
    const cols: ColumnDef<CaseRow>[] = [
      {
        accessorKey: "unit",
        header: t("unit"),
        cell: ({ row }) => (
          <div className="max-w-[11rem] sm:max-w-[14rem]">
            <Link
              href={`/units/${row.original.unitId}`}
              className="block truncate font-medium hover:underline"
              title={`${labels.project(row.original.project)} · ${row.original.unitCode}`}
            >
              {labels.project(row.original.project)} · {row.original.unitCode}
            </Link>
            {row.original.unitDisplayFields ? (
              <UnitDisplayFieldsCompactLine
                fields={row.original.unitDisplayFields}
                locale={locale}
                maxWidthClass="max-w-full"
              />
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "client",
        header: t("client"),
        cell: ({ row }) => (
          <span className="block max-w-[10rem] truncate" title={row.original.client}>
            {row.original.client}
          </span>
        ),
      },
      {
        accessorKey: "category",
        header: t("category"),
        cell: ({ row }) => (
          <Badge variant="outline">
            {categoryLabels[row.original.category] ?? row.original.category}
          </Badge>
        ),
      },
      {
        accessorKey: "notes",
        header: t("caseNotes"),
        cell: ({ row }) => (
          <p
            className="max-w-md whitespace-normal line-clamp-3 text-sm leading-snug"
            title={row.original.notes}
          >
            {isAwaitingResponseNote(row.original.notes) ? (
              <span className="text-amber-600 dark:text-amber-400">
                {t("awaitingResponse")}
              </span>
            ) : (
              row.original.notes
            )}
          </p>
        ),
      },
      {
        id: "agent",
        header: canAssign ? t("assignToCs") : t("agent"),
        cell: ({ row }) =>
          canAssign ? (
            <TicketAgentAssignForm
              ticketId={row.original.id}
              agentId={row.original.agentId}
              agentName={row.original.agent}
              agents={agents}
              assignLabel={t("assign")}
              unassignedLabel={t("unassigned")}
              formatStaffName={labels.staffName}
            />
          ) : (
            <span className="text-sm">
              {row.original.effectiveAgent
                ? labels.staffName(row.original.effectiveAgent)
                : t("unassigned")}
            </span>
          ),
      },
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span className="text-sm">{labels.ticketStatus(row.original.status)}</span>
            {row.original.pendingParty !== "NONE" ? (
              <Badge variant="secondary" className="w-fit text-xs">
                {labels.pendingParty(row.original.pendingParty)}
              </Badge>
            ) : null}
            {isFollowUpDue(row.original.nextFollowUpDate) ? (
              <Badge variant="destructive" className="w-fit text-xs">
                {tFilters("dueToday")}
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "manage",
        header: tCommon("actions"),
        cell: ({ row }) => (
          <div className="flex min-w-[12rem] flex-col gap-2 whitespace-normal">
            <TicketStatusForm
              ticketId={row.original.id}
              status={row.original.status}
              statusItems={rowStatusItems}
              saveLabel={tCommon("save")}
              canUseManagementOverride={canUseManagementOverride}
            />
          </div>
        ),
      },
    ];

    return cols;
  }, [agents, canAssign, canUseManagementOverride, categoryLabels, labels, rowStatusItems, t, tCommon, tFilters]);

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
    initialState: { pagination: { pageSize: 20 } },
  });

  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const total = filtered.length;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {(sectionTitle || sectionDescription) && (
        <div className="flex items-start justify-between gap-3">
          <div>
            {sectionTitle ? (
              <h2 className="text-xl font-semibold tracking-tight">{sectionTitle}</h2>
            ) : null}
            {sectionDescription && !collapsed ? (
              <p className="text-sm text-muted-foreground">{sectionDescription}</p>
            ) : null}
          </div>
          {defaultCollapsed ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? t("showSection") : t("hideSection")}
            </Button>
          ) : null}
        </div>
      )}
      {!collapsed ? (
        <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <Input
          placeholder={tCommon("search")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            table.setPageIndex(0);
          }}
          className="xl:col-span-2 2xl:col-span-2"
        />
        <Select
          value={projectFilter}
          onValueChange={(value) => {
            pushUrlFilters({
              ...urlFilters,
              project: value ?? "all",
            });
            table.setPageIndex(0);
          }}
          items={projectItems}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("project")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allProjects")}</SelectItem>
            {Object.entries(projectItems)
              .filter(([key]) => key !== "all")
              .map(([slug, label]) => (
                <SelectItem key={slug} value={slug}>
                  {label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(value) => {
            pushUrlFilters({
              ...urlFilters,
              category: value ?? "all",
            });
            table.setPageIndex(0);
          }}
          items={categoryItems}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            {CATEGORY_FILTER_ORDER.map((category) => (
              <SelectItem key={category} value={category}>
                {labels.ticketCategory(category)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            pushUrlFilters({
              ...urlFilters,
              status: (value ?? "all") as CasesPageFilters["status"],
            });
            table.setPageIndex(0);
          }}
          items={statusItems}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="open">{t("openCases")}</SelectItem>
            {TICKET_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {labels.ticketStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={agentFilter}
          onValueChange={(value) => {
            if (value == null) return;
            const agent =
              value === UNASSIGNED_AGENT_FILTER
                ? "unassigned"
                : value === "all"
                  ? "all"
                  : agents.find((a) => a.name === value)?.id ?? value;
            pushUrlFilters({ ...urlFilters, agent });
            table.setPageIndex(0);
          }}
          items={agentFilterItems}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("agent")} />
          </SelectTrigger>
          <SelectContent>
            {agentSelectItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={followUpFilter}
          onValueChange={(value) => {
            pushUrlFilters({
              ...urlFilters,
              followUp: value === "due" ? "due" : "all",
            });
            table.setPageIndex(0);
          }}
          items={{ all: t("allFollowUps"), due: tFilters("dueToday") }}
        >
          <SelectTrigger>
            <SelectValue placeholder={tFilters("dueToday")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allFollowUps")}</SelectItem>
            <SelectItem value="due">{tFilters("dueToday")}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={pendingPartyFilter}
          onValueChange={(value) => {
            pushUrlFilters({
              ...urlFilters,
              pendingParty: value ?? "all",
            });
            table.setPageIndex(0);
          }}
          items={{
            all: t("allPendingParties"),
            ...Object.fromEntries(
              PENDING_PARTY_CHART_KEYS.map((party) => [
                party,
                labels.pendingParty(party),
              ])
            ),
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("pendingParty")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allPendingParties")}</SelectItem>
            {PENDING_PARTY_CHART_KEYS.map((party) => (
              <SelectItem key={party} value={party}>
                {labels.pendingParty(party)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeFilterChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("filters.activeLabel")}
          </span>
          {activeFilterChips.map((chip) => (
            <RemovableFilterChip
              key={chip.key}
              label={chip.label}
              onRemove={chip.clear}
            />
          ))}
          {isCasesFilterActive(urlFilters) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                pushUrlFilters(DEFAULT_CASES_FILTERS);
                table.setPageIndex(0);
              }}
            >
              {t("filters.clearAll")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {canExport ? (
        <div className="flex justify-end">
          <ExportCsvButton
            label={t("exportCsv")}
            filenamePrefix="cases"
            headers={exportHeaders}
            rows={exportRows}
          />
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {t("showingResults", { from, to, total })}
      </p>

      <div
        data-cases-table-scroll
        className="relative min-w-0 max-h-[min(70vh,calc(100dvh-14rem))] overflow-auto overscroll-x-contain rounded-md border bg-background"
      >
        <table
          data-slot="table"
          className={cn(
            "w-max table-fixed border-separate border-spacing-0 caption-bottom text-sm",
            CASE_TABLE_MIN_WIDTH
          )}
        >
          <colgroup>
            {table.getVisibleLeafColumns().map((column) => (
              <col
                key={column.id}
                className={CASE_COLUMN_CLASS[column.id] ?? "w-[8rem]"}
              />
            ))}
          </colgroup>
          <TableHeader className="sticky top-0 z-20 bg-background [&_tr]:border-b [&_tr]:shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "sticky top-0 z-20 h-auto overflow-hidden bg-background p-0 align-middle",
                      CASE_COLUMN_CLASS[header.column.id]
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      <CaseTableHeaderCell>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </CaseTableHeaderCell>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "align-top overflow-hidden whitespace-normal break-words bg-background",
                        CASE_COLUMN_CLASS[cell.column.id]
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {tCommon("noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t("rowsPerPage")}</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {formatLocaleInteger(size, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {tCommon("previous")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("pageOf", {
              page: formatLocaleInteger(pageIndex + 1, locale),
              pages: formatLocaleInteger(Math.max(table.getPageCount(), 1), locale),
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {tCommon("next")}
          </Button>
        </div>
      </div>
        </>
      ) : null}
    </div>
  );
}
