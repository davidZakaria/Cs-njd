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
import { useDomainLabels } from "@/hooks/use-domain-labels";
import {
  isUnassignedAgentName,
  UNASSIGNED_AGENT_FILTER,
} from "@/lib/filters";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExportCsvButton } from "@/components/export/export-csv-button";

export type UnitRow = {
  id: string;
  unitCode: string;
  project: string;
  client: string;
  type: string;
  area: number | null;
  agent: string;
  handoverStatus: string;
};

export function UnitsTable({
  data,
  projects,
  agents,
  statuses,
}: {
  data: UnitRow[];
  projects: string[];
  agents: string[];
  statuses: string[];
}) {
  const t = useTranslations("units");
  const tCommon = useTranslations("common");
  const labels = useDomainLabels();
  const [globalFilter, setGlobalFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const projectItems = useMemo(() => {
    const items: Record<string, string> = { all: labels.all };
    for (const project of projects) {
      items[project] = labels.project(project);
    }
    return items;
  }, [projects, labels]);

  const agentSelectItems = useMemo(
    () => [
      { value: "all", label: labels.all },
      { value: UNASSIGNED_AGENT_FILTER, label: labels.unassigned },
      ...agents.map((agent) => ({
        value: agent,
        label: labels.staffName(agent),
      })),
    ],
    [agents, labels]
  );

  const agentItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const item of agentSelectItems) {
      items[item.value] = item.label;
    }
    return items;
  }, [agentSelectItems]);

  const statusItems = useMemo(() => {
    const items: Record<string, string> = { all: labels.all };
    for (const status of statuses) {
      items[status] = labels.handoverStatus(status);
    }
    return items;
  }, [statuses, labels]);

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (projectFilter !== "all" && row.project !== projectFilter) return false;
      if (agentFilter === UNASSIGNED_AGENT_FILTER) {
        if (!isUnassignedAgentName(row.agent)) return false;
      } else if (agentFilter !== "all" && row.agent !== agentFilter) {
        return false;
      }
      if (statusFilter !== "all" && row.handoverStatus !== statusFilter) return false;
      if (!globalFilter) return true;
      const q = globalFilter.toLowerCase();
      return (
        row.unitCode.toLowerCase().includes(q) ||
        row.client.toLowerCase().includes(q) ||
        row.project.toLowerCase().includes(q) ||
        labels.project(row.project).toLowerCase().includes(q)
      );
    });
  }, [data, projectFilter, agentFilter, statusFilter, globalFilter, labels]);

  const exportHeaders = useMemo(
    () => [
      t("unitCode"),
      t("project"),
      t("client"),
      t("type"),
      t("area"),
      t("agent"),
      t("handoverStatus"),
    ],
    [t]
  );

  const exportRows = useMemo(
    () =>
      filteredData.map((row) => [
        row.unitCode,
        labels.project(row.project),
        row.client,
        labels.unitType(row.type),
        labels.areaWithUnit(row.area),
        isUnassignedAgentName(row.agent)
          ? labels.unassigned
          : labels.staffName(row.agent),
        labels.handoverStatus(row.handoverStatus),
      ]),
    [filteredData, labels]
  );

  const columns = useMemo<ColumnDef<UnitRow>[]>(
    () => [
      {
        accessorKey: "unitCode",
        header: t("unitCode"),
        cell: ({ row }) => (
          <Link
            href={`/units/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.unitCode}
          </Link>
        ),
      },
      {
        accessorKey: "project",
        header: t("project"),
        cell: ({ row }) => labels.project(row.original.project),
      },
      { accessorKey: "client", header: t("client") },
      {
        accessorKey: "type",
        header: t("type"),
        cell: ({ row }) => labels.unitType(row.original.type),
      },
      {
        accessorKey: "area",
        header: t("area"),
        cell: ({ row }) => labels.areaWithUnit(row.original.area),
      },
      {
        accessorKey: "agent",
        header: t("agent"),
        cell: ({ row }) =>
          isUnassignedAgentName(row.original.agent)
            ? labels.unassigned
            : labels.staffName(row.original.agent),
      },
      {
        accessorKey: "handoverStatus",
        header: t("handoverStatus"),
        cell: ({ row }) => (
          <Badge variant="outline">
            {labels.handoverStatus(row.original.handoverStatus)}
          </Badge>
        ),
      },
    ],
    [t, labels]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <Input
          placeholder={tCommon("search")}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="lg:max-w-xs"
        />
        <Select
          value={projectFilter}
          onValueChange={(v) => {
            setProjectFilter(v ?? "all");
            table.setPageIndex(0);
          }}
          items={projectItems}
        >
          <SelectTrigger className="lg:w-48">
            <SelectValue placeholder={t("project")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{labels.all}</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p} value={p}>
                {labels.project(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={agentFilter}
          onValueChange={(v) => {
            if (!v) return;
            setAgentFilter(v);
            table.setPageIndex(0);
          }}
          items={agentItems}
        >
          <SelectTrigger className="lg:w-48">
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
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v ?? "all");
            table.setPageIndex(0);
          }}
          items={statusItems}
        >
          <SelectTrigger className="lg:w-48">
            <SelectValue placeholder={t("handoverStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{labels.all}</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {labels.handoverStatus(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ExportCsvButton
          label={t("exportCsv")}
          filenamePrefix="units"
          headers={exportHeaders}
          rows={exportRows}
          className="w-full lg:ms-auto lg:w-auto"
        />
      </div>

      <div className="min-w-0 overflow-x-auto rounded-md border">
        <Table className="min-w-[52rem]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
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
                    <TableCell key={cell.id} className="align-top whitespace-normal">
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

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {tCommon("previous")}
        </Button>
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
  );
}
