"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type LoginHistoryRow = {
  id: string;
  email: string;
  ipAddress: string | null;
  browser: string;
  status:
    | "SUCCESS"
    | "FAILED"
    | "PASSWORD_OK"
    | "TWO_FACTOR_SUCCESS"
    | "TWO_FACTOR_FAILED";
  timestampLabel: string;
};

function statusLabel(
  status: LoginHistoryRow["status"],
  t: ReturnType<typeof useTranslations>
): string {
  switch (status) {
    case "SUCCESS":
      return t("statusSuccess");
    case "FAILED":
      return t("statusFailed");
    case "PASSWORD_OK":
      return t("statusPasswordOk");
    case "TWO_FACTOR_SUCCESS":
      return t("statusTwoFactorSuccess");
    case "TWO_FACTOR_FAILED":
      return t("statusTwoFactorFailed");
    default:
      return status;
  }
}

function statusVariant(
  status: LoginHistoryRow["status"]
): "secondary" | "destructive" | "outline" {
  if (status === "FAILED" || status === "TWO_FACTOR_FAILED") {
    return "destructive";
  }
  if (status === "PASSWORD_OK") {
    return "outline";
  }
  return "secondary";
}

const COLUMN_WIDTHS: Record<string, string> = {
  email: "w-[22%]",
  ipAddress: "w-[12rem]",
  browser: "w-[24%]",
  status: "w-[8rem]",
  timestamp: "w-[14rem]",
};

export function LoginHistoryTable({ data }: { data: LoginHistoryRow[] }) {
  const t = useTranslations("systemSecurity");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const columns = useMemo<ColumnDef<LoginHistoryRow>[]>(
    () => [
      { accessorKey: "email", header: t("columns.email") },
      {
        accessorKey: "ipAddress",
        header: t("columns.ip"),
        cell: ({ row }) => row.original.ipAddress ?? "—",
      },
      {
        accessorKey: "browser",
        header: t("columns.browser"),
        cell: ({ row }) => (
          <span className="line-clamp-2 whitespace-normal text-sm">
            {row.original.browser}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.status)}>
            {statusLabel(row.original.status, t)}
          </Badge>
        ),
      },
      {
        accessorKey: "timestampLabel",
        header: t("columns.time"),
      },
    ],
    [t]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div className="space-y-4" dir={locale === "ar" ? "rtl" : "ltr"}>
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
                      COLUMN_WIDTHS[header.column.id]
                    )}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
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
                        "align-top whitespace-normal break-words text-sm",
                        COLUMN_WIDTHS[cell.column.id]
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

      <div className="flex justify-end gap-2">
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
