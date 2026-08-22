"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Role } from "@prisma/client";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CreateUserSheet } from "@/components/users/create-user-sheet";
import { UserCell } from "@/components/users/user-cell";
import { UserRoleBadge } from "@/components/users/user-role-badge";
import { UserRowActionsMenu } from "@/components/users/user-row-actions-menu";
import { UserTwoFactorBadge } from "@/components/users/user-two-factor-badge";
import type { UserRow } from "@/components/users/types";
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
import { entranceAnimationClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";

const ROLE_FILTER_ALL = "all";

const USER_COLUMN_WIDTHS: Record<string, string> = {
  user: "w-[34%]",
  role: "w-[12rem]",
  twoFactor: "w-[10rem]",
  actions: "w-[5rem]",
};

export function UsersDataTable({
  data,
  canCreate,
  isSuperAdmin,
  currentUserId,
  currentUserRole,
}: {
  data: UserRow[];
  canCreate: boolean;
  isSuperAdmin: boolean;
  currentUserId: string;
  currentUserRole: Role;
}) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const [globalFilter, setGlobalFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(ROLE_FILTER_ALL);
  const [createOpen, setCreateOpen] = useState(false);

  const roleFilterItems = useMemo(() => {
    const items: Record<string, string> = {
      [ROLE_FILTER_ALL]: t("allRoles"),
    };
    if (isSuperAdmin) {
      items.SUPER_ADMIN = t("roles.superAdmin");
      items.MANAGEMENT = t("roles.management");
    }
    items.CS_AGENT = t("roles.csAgent");
    return items;
  }, [isSuperAdmin, t]);

  const filteredData = useMemo(() => {
    const query = globalFilter.trim().toLowerCase();
    return data.filter((row) => {
      if (roleFilter !== ROLE_FILTER_ALL && row.role !== roleFilter) {
        return false;
      }
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        row.email.toLowerCase().includes(query)
      );
    });
  }, [data, globalFilter, roleFilter]);

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        id: "user",
        header: t("userColumn"),
        cell: ({ row }) => (
          <UserCell name={row.original.name} email={row.original.email} />
        ),
      },
      {
        accessorKey: "role",
        header: t("role"),
        cell: ({ row }) => <UserRoleBadge role={row.original.role} />,
      },
      {
        id: "twoFactor",
        header: t("twoFactor"),
        cell: ({ row }) => (
          <UserTwoFactorBadge enabled={row.original.is2FAEnabled} />
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{tCommon("actions")}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <UserRowActionsMenu
              user={row.original}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              isSuperAdmin={isSuperAdmin}
            />
          </div>
        ),
      },
    ],
    [currentUserId, currentUserRole, isSuperAdmin, t, tCommon]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div className={cn("space-y-4", entranceAnimationClass, "animate-delay-100")}>
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm backdrop-blur-lg",
          "supports-[backdrop-filter]:bg-background/60 lg:flex-row lg:flex-wrap lg:items-center"
        )}
      >
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchUsers")}
            value={globalFilter}
            onChange={(event) => {
              setGlobalFilter(event.target.value);
              table.setPageIndex(0);
            }}
            className="ps-9"
          />
        </div>

        <Select
          value={roleFilter}
          onValueChange={(value) => {
            setRoleFilter(value ?? ROLE_FILTER_ALL);
            table.setPageIndex(0);
          }}
          items={roleFilterItems}
        >
          <SelectTrigger className="w-full lg:w-52">
            <SelectValue placeholder={t("filterByRole")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ROLE_FILTER_ALL}>{t("allRoles")}</SelectItem>
            {isSuperAdmin && (
              <>
                <SelectItem value="SUPER_ADMIN">
                  {t("roles.superAdmin")}
                </SelectItem>
                <SelectItem value="MANAGEMENT">
                  {t("roles.management")}
                </SelectItem>
              </>
            )}
            <SelectItem value="CS_AGENT">{t("roles.csAgent")}</SelectItem>
          </SelectContent>
        </Select>

        {canCreate ? (
          <Button
            type="button"
            className="w-full shrink-0 lg:ms-auto lg:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" />
            {t("addNewUser")}
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border/50 bg-card shadow-premium",
          entranceAnimationClass,
          "animate-delay-150"
        )}
      >
        <div className="min-w-0 rounded-xl border border-border/50 bg-card shadow-premium">
          <Table className="min-w-[36rem] table-fixed">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-border/50 bg-muted/30 hover:bg-muted/30"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "whitespace-nowrap",
                        USER_COLUMN_WIDTHS[header.column.id]
                      )}
                    >
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
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="transition-colors hover:bg-muted/50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "align-middle whitespace-normal break-words",
                          USER_COLUMN_WIDTHS[cell.column.id]
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-28 text-center text-muted-foreground"
                  >
                    {t("noUsersFound")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {t("showingUsers", {
            count: filteredData.length,
            total: data.length,
          })}
        </span>
        <div className="flex items-center gap-2">
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

      {canCreate ? (
        <CreateUserSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          isSuperAdmin={isSuperAdmin}
        />
      ) : null}
    </div>
  );
}
