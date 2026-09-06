"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CheckCircle2, Clock, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { NotificationLogRow } from "@/lib/actions/notification-log";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function NotificationsLogTable({ rows }: { rows: NotificationLogRow[] }) {
  const locale = useLocale();
  const t = useTranslations("notificationsLog");
  const tRoles = useTranslations("users.roles");
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<NotificationLogRow>[]>(
    () => [
      {
        id: "timestamp",
        header: t("columns.timestamp"),
        accessorKey: "createdAt",
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleString(
            locale === "ar" ? "ar-EG" : "en-GB",
            { dateStyle: "medium", timeStyle: "short" }
          ),
      },
      {
        id: "recipient",
        header: t("columns.recipient"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.recipientName}</p>
            <p className="text-xs text-muted-foreground">
              {tRoles(
                ({
                  SUPER_ADMIN: "superAdmin",
                  MANAGEMENT: "management",
                  CS_AGENT: "csAgent",
                  ENGINEER: "engineer",
                }[row.original.recipientRole] ?? "csAgent") as "superAdmin"
              )}
            </p>
          </div>
        ),
      },
      {
        id: "title",
        header: t("columns.title"),
        cell: ({ row }) =>
          locale === "ar" ? row.original.titleAr : row.original.titleEn,
      },
      {
        id: "message",
        header: t("columns.message"),
        cell: ({ row }) =>
          locale === "ar" ? row.original.messageAr : row.original.messageEn,
      },
      {
        id: "readStatus",
        header: t("columns.readStatus"),
        cell: ({ row }) =>
          row.original.isRead ? (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="size-4" />
              {t("read")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="size-4" />
              {t("unread")}
            </span>
          ),
      },
    ],
    [locale, t, tRoles]
  );

  const filteredRows = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.searchText.includes(q));
  }, [globalFilter, rows]);

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="ps-9"
        />
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <Badge variant="secondary" className="tabular-nums">
          {t("total", { count: filteredRows.length })}
        </Badge>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(
              "rounded-md border px-2 py-1",
              !table.getCanPreviousPage() && "opacity-50"
            )}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            {t("previous")}
          </button>
          <span className="tabular-nums">
            {t("page", {
              current: table.getState().pagination.pageIndex + 1,
              total: table.getPageCount() || 1,
            })}
          </span>
          <button
            type="button"
            className={cn(
              "rounded-md border px-2 py-1",
              !table.getCanNextPage() && "opacity-50"
            )}
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            {t("next")}
          </button>
        </div>
      </div>
    </div>
  );
}
