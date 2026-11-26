"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Download, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AuditLogDiffPanel } from "@/components/audit/audit-log-diff-panel";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditRecordCell } from "@/components/audit/audit-record-cell";
import { exportAuditLogsCsv } from "@/lib/actions/audit-logs";
import { downloadCsvFile } from "@/lib/export/csv";
import { AUDITED_MODELS } from "@/lib/prisma/audited-models";
import { cn } from "@/lib/utils";

export type AuditLogListRow = {
  id: string;
  action: string;
  actionKey: string;
  tableName: string;
  tableKey: string;
  recordId: string;
  recordLabel: string | null;
  user: string;
  timestamp: string;
  ipAddress: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  referenceLabels?: Record<string, string>;
};

const ALL = "__all__";

export function AuditLogsPanel({
  rows,
  total,
  page,
  pageCount,
  pageSize,
  actors,
}: {
  rows: AuditLogListRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  actors: { id: string; name: string; email: string }[];
}) {
  const t = useTranslations("audit");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<AuditLogListRow | null>(null);
  const [qDraft, setQDraft] = useState(searchParams.get("q") ?? "");

  const filterValue = useCallback(
    (key: string) => searchParams.get(key) ?? "",
    [searchParams]
  );

  const pushFilters = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value == null || value === "" || value === ALL) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      if (!("page" in updates)) {
        next.delete("page");
      }
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  const actionOptions = useMemo(
    () =>
      [
        "CREATE",
        "UPDATE",
        "DELETE",
        "TWO_FACTOR_RESET",
        "PASSWORD_CHANGE",
        "SESSION_REVOKE",
        "EXPORT",
      ] as const,
    []
  );

  async function handleExport() {
    const input = Object.fromEntries(searchParams.entries());
    const result = await exportAuditLogsCsv(input, locale);
    if (result.success) {
      downloadCsvFile(result.data.filename, result.data.csv);
    }
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("filters.dateFrom")}</label>
            <Input
              type="date"
              dir="ltr"
              className="text-start"
              value={filterValue("dateFrom")}
              onChange={(e) => pushFilters({ dateFrom: e.target.value, page: null })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("filters.dateTo")}</label>
            <Input
              type="date"
              dir="ltr"
              className="text-start"
              value={filterValue("dateTo")}
              onChange={(e) => pushFilters({ dateTo: e.target.value, page: null })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("filters.actor")}</label>
            <Select
              value={filterValue("actorId") || ALL}
              onValueChange={(v) => pushFilters({ actorId: v, page: null })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("filters.allActors")}>
                  {filterValue("actorId")
                    ? actors.find((a) => a.id === filterValue("actorId"))?.name
                    : t("filters.allActors")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("filters.allActors")}</SelectItem>
                {actors.map((actor) => (
                  <SelectItem key={actor.id} value={actor.id}>
                    {actor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("filters.entity")}</label>
            <Select
              value={filterValue("tableName") || ALL}
              onValueChange={(v) => pushFilters({ tableName: v, page: null })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("filters.allEntities")}>
                  {filterValue("tableName")
                    ? t.has(`tables.${filterValue("tableName")}` as Parameters<typeof t>[0])
                      ? t(`tables.${filterValue("tableName")}` as Parameters<typeof t>[0])
                      : filterValue("tableName")
                    : t("filters.allEntities")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("filters.allEntities")}</SelectItem>
                {AUDITED_MODELS.map((model) => {
                  const key = model === "Ticket" ? "Ticket" : model;
                  const labelKey = `tables.${key}` as Parameters<typeof t>[0];
                  return (
                    <SelectItem key={model} value={model}>
                      {t.has(labelKey) ? t(labelKey) : model}
                    </SelectItem>
                  );
                })}
                <SelectItem value="AuditLog">{t("tables.AuditLog")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("filters.action")}</label>
            <Select
              value={filterValue("action") || ALL}
              onValueChange={(v) => pushFilters({ action: v, page: null })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("filters.allActions")}>
                  {filterValue("action")
                    ? t(`actions.${filterValue("action")}` as Parameters<typeof t>[0])
                    : t("filters.allActions")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("filters.allActions")}</SelectItem>
                {actionOptions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {t(`actions.${action}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("filters.recordId")}</label>
            <Input
              value={filterValue("recordId")}
              onChange={(e) => pushFilters({ recordId: e.target.value, page: null })}
              placeholder={t("filters.recordIdPlaceholder")}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">{t("filters.search")}</label>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                pushFilters({ q: qDraft.trim(), page: null });
              }}
            >
              <Input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
              />
              <Button type="submit" variant="secondary" className="shrink-0 gap-1">
                <Search className="size-4" />
                {tCommon("search")}
              </Button>
            </form>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5 self-end"
          disabled={pending || total === 0}
          onClick={() => void handleExport()}
        >
          <Download className="size-4" />
          {t("export.action")}
        </Button>
      </div>

      <div className="min-w-0 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("action")}</TableHead>
              <TableHead>{t("entity")}</TableHead>
              <TableHead>{t("record")}</TableHead>
              <TableHead>{t("user")}</TableHead>
              <TableHead>{t("timestamp")}</TableHead>
              <TableHead>{t("ip")}</TableHead>
              <TableHead className="w-[6rem]">
                <span className="sr-only">{t("diff.view")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-audit-entry={`${row.tableKey}:${row.actionKey}`}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelected(row)}
                >
                  <TableCell>{row.action}</TableCell>
                  <TableCell>{row.tableName}</TableCell>
                  <TableCell>
                    <AuditRecordCell
                      recordId={row.recordId}
                      recordLabel={row.recordLabel}
                    />
                  </TableCell>
                  <TableCell>{row.user}</TableCell>
                  <TableCell className="whitespace-nowrap">{row.timestamp}</TableCell>
                  <TableCell>{row.ipAddress}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-audit-details={row.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(row);
                      }}
                    >
                      {t("diff.view")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("pagination.summary", { from, to, total })}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || pending}
            onClick={() => pushFilters({ page: String(page - 1) })}
          >
            {tCommon("previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount || pending}
            onClick={() => pushFilters({ page: String(page + 1) })}
          >
            {tCommon("next")}
          </Button>
        </div>
      </div>

      <Sheet open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent
          side={locale === "ar" ? "left" : "right"}
          className={cn(
            "flex w-full max-w-md flex-col overflow-y-auto sm:max-w-md",
            locale === "ar" ? "left-0 border-r" : "right-0 border-l"
          )}
        >
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{t("diff.title")}</SheetTitle>
                <SheetDescription>
                  {selected.action} · {selected.tableName} ·{" "}
                  {selected.recordLabel ?? selected.recordId}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <AuditLogDiffPanel
                  tableName={selected.tableKey}
                  oldData={selected.oldData}
                  newData={selected.newData}
                  referenceLabels={selected.referenceLabels}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}