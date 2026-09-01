"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
import { projectNameToSlug } from "@/lib/cases/cases-filter-url";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import { cn } from "@/lib/utils";

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

const CASE_COLUMN_WIDTHS: Record<string, string> = {
  unit: "w-[11rem]",
  client: "w-[10rem]",
  category: "w-[9rem]",
  notes: "w-[28%]",
  agent: "w-[11rem]",
  status: "w-[7rem]",
  manage: "w-[12rem]",
};

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
  defaultCollapsed = false,
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
  defaultCollapsed?: boolean;
}) {
  const t = useTranslations("cases");
  const tCommon = useTranslations("common");
  const tFilters = useTranslations("filters");
  const labels = useDomainLabels();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter);
  const [projectFilter, setProjectFilter] = useState(defaultProjectFilter);
  const [categoryFilter, setCategoryFilter] = useState(defaultCategoryFilter);
  const [agentFilter, setAgentFilter] = useState(
    defaultAgentFilter === "unassigned"
      ? UNASSIGNED_AGENT_FILTER
      : defaultAgentFilter
  );
  const [followUpFilter, setFollowUpFilter] = useState(defaultFollowUpFilter);
  const [pendingPartyFilter, setPendingPartyFilter] = useState(
    defaultPendingPartyFilter
  );

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
    const rows = data.filter((row) => {
      if (
        statusFilter === "open" &&
        !OPEN_TICKET_STATUSES.includes(
          row.status as (typeof OPEN_TICKET_STATUSES)[number]
        )
      ) {
        return false;
      }
      if (
        statusFilter !== "all" &&
        statusFilter !== "open" &&
        row.status !== statusFilter
      ) {
        return false;
      }
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (
        projectFilter !== "all" &&
        projectNameToSlug(row.project) !== projectFilter
      ) {
        return false;
      }
      if (agentFilter === UNASSIGNED_AGENT_FILTER) {
        if (!isUnassignedAgentName(row.effectiveAgent)) return false;
      } else if (agentFilter !== "all" && row.effectiveAgent !== agentFilter) {
        return false;
      }
      if (
        followUpFilter === "due" &&
        !isFollowUpDue(row.nextFollowUpDate)
      ) {
        return false;
      }
      if (
        pendingPartyFilter !== "all" &&
        row.pendingParty !== pendingPartyFilter
      ) {
        return false;
      }
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        row.notes.toLowerCase().includes(q) ||
        row.unitCode.toLowerCase().includes(q) ||
        row.client.toLowerCase().includes(q) ||
        row.project.toLowerCase().includes(q)
      );
    });

    if (categoryFilter !== "all") return rows;

    return [...rows].sort(
      (a, b) => categoryFilterRank(a.category) - categoryFilterRank(b.category)
    );
  }, [data, statusFilter, projectFilter, categoryFilter, agentFilter, followUpFilter, pendingPartyFilter, query]);

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
        new Date(row.createdAt).toLocaleString(),
      ]),
    [filtered, labels, categoryLabels, t]
  );

  const columns = useMemo<ColumnDef<CaseRow>[]>(() => {
    const cols: ColumnDef<CaseRow>[] = [
      {
        accessorKey: "unit",
        header: t("unit"),
        cell: ({ row }) => (
          <Link
            href={`/units/${row.original.unitId}`}
            className="font-medium hover:underline"
          >
            {labels.project(row.original.project)} · {row.original.unitCode}
          </Link>
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
            setProjectFilter(value ?? "all");
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
            setCategoryFilter(value ?? "all");
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
            setStatusFilter(value ?? "all");
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
            setAgentFilter(value);
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
            setFollowUpFilter(value === "due" ? "due" : "all");
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
      </div>

      <div className="flex justify-end">
        <ExportCsvButton
          label={t("exportCsv")}
          filenamePrefix="cases"
          headers={exportHeaders}
          rows={exportRows}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {t("showingResults", { from, to, total })}
      </p>

      <div className="min-w-0 rounded-md border">
        <Table className="min-w-[56rem] table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "whitespace-nowrap",
                      CASE_COLUMN_WIDTHS[header.column.id]
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
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
                        "align-top whitespace-normal break-words",
                        CASE_COLUMN_WIDTHS[cell.column.id]
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
        </Table>
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
                  {size}
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
              page: pageIndex + 1,
              pages: Math.max(table.getPageCount(), 1),
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
