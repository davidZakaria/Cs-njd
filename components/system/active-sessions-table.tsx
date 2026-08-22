"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ShieldOff } from "lucide-react";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import { killUserSessions } from "@/lib/actions/system-security";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { UserRoleBadge } from "@/components/users/user-role-badge";
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
import type { Role } from "@prisma/client";

export type ActiveSessionUserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastLoginLabel: string;
  sessionVersion: number;
};

const COLUMN_WIDTHS: Record<string, string> = {
  user: "w-[26%]",
  role: "w-[10rem]",
  lastLogin: "w-[14rem]",
  sessionVersion: "w-[8rem]",
  actions: "w-[12rem]",
};

export function ActiveSessionsTable({
  data,
  currentUserId,
}: {
  data: ActiveSessionUserRow[];
  currentUserId: string;
}) {
  const t = useTranslations("systemSecurity");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { pending, runAction } = useCrudToast();

  const columns = useMemo<ColumnDef<ActiveSessionUserRow>[]>(
    () => [
      {
        id: "user",
        header: t("columns.user"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: t("columns.role"),
        cell: ({ row }) => <UserRoleBadge role={row.original.role} />,
      },
      {
        accessorKey: "lastLoginLabel",
        header: t("columns.lastLogin"),
      },
      {
        accessorKey: "sessionVersion",
        header: t("columns.sessionVersion"),
        cell: ({ row }) => (
          <span className="font-mono text-sm tabular-nums">
            v{row.original.sessionVersion}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("columns.actions"),
        cell: ({ row }) => {
          const isSelf = row.original.id === currentUserId;
          return (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending || isSelf}
              className="gap-1.5 shadow-sm"
              onClick={() => {
                if (
                  !window.confirm(
                    t("killConfirm", { name: row.original.name })
                  )
                ) {
                  return;
                }
                runAction(
                  async () => {
                    const result = await killUserSessions(row.original.id);
                    if (result.success) {
                      router.refresh();
                    }
                    return result;
                  },
                  "saved",
                  t("killSuccess")
                );
              }}
            >
              <ShieldOff className="size-3.5" />
              {t("killSessions")}
            </Button>
          );
        },
      },
    ],
    [currentUserId, pending, router, runAction, t]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 12 } },
  });

  return (
    <div className="space-y-4" dir={locale === "ar" ? "rtl" : "ltr"}>
      <p className="text-sm text-muted-foreground">{t("sessionsHint")}</p>
      <div className="min-w-0 rounded-md border">
        <Table className="min-w-[52rem] table-fixed">
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
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "align-top whitespace-normal break-words",
                      COLUMN_WIDTHS[cell.column.id]
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
