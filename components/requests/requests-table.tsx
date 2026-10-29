"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";

import { RemovableFilterChip } from "@/components/filters/removable-filter-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format/datetime";
import {
  buildRequestsPageUrl,
  isRequestsFilterActive,
  type RequestsPageFilters,
  projectNameToSlug,
} from "@/lib/requests/requests-filter-url";
import { isRequestOverdue } from "@/lib/requests/queries";
import { UnitRequestStatus, UnitRequestType } from "@prisma/client";
import { cn } from "@/lib/utils";

export type RequestRow = {
  id: string;
  type: UnitRequestType;
  status: UnitRequestStatus;
  dueDate: string | null;
  submittedAt: string | null;
  currentApproverKind: string | null;
  escalatedToManagement: boolean;
  requestedByName: string;
  unitId: string;
  unitCode: string;
  projectName: string;
  clientName: string;
};

const REQUEST_TYPES = Object.values(UnitRequestType);
const REQUEST_STATUSES = Object.values(UnitRequestStatus);

export function RequestsTable({
  rows,
  projects,
  initialFilters,
}: {
  rows: RequestRow[];
  projects: string[];
  initialFilters: RequestsPageFilters;
}) {
  const t = useTranslations("requests");
  const tEnums = useTranslations("enums");
  const locale = useLocale();
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);

  const syncUrl = (next: RequestsPageFilters) => {
    setFilters(next);
    router.replace(buildRequestsPageUrl(next));
  };

  const chips = useMemo(() => {
    const list: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (filters.status !== "all") {
      list.push({
        key: "status",
        label: tEnums(`unitRequestStatus.${filters.status}`),
        onRemove: () => syncUrl({ ...filters, status: "all" }),
      });
    }
    if (filters.type !== "all") {
      list.push({
        key: "type",
        label: tEnums(`unitRequestType.${filters.type}`),
        onRemove: () => syncUrl({ ...filters, type: "all" }),
      });
    }
    if (filters.project !== "all") {
      list.push({
        key: "project",
        label: filters.project,
        onRemove: () => syncUrl({ ...filters, project: "all" }),
      });
    }
    if (filters.overdue === "yes") {
      list.push({
        key: "overdue",
        label: t("filters.overdue"),
        onRemove: () => syncUrl({ ...filters, overdue: "all" }),
      });
    }
    return list;
  }, [filters, t, tEnums]);

  return (
    <div className="space-y-4">
      <Tabs
        value={filters.view}
        onValueChange={(value) =>
          syncUrl({
            ...filters,
            view: value as RequestsPageFilters["view"],
          })
        }
      >
        <TabsList>
          <TabsTrigger value="awaiting">{t("views.awaiting")}</TabsTrigger>
          <TabsTrigger value="submitted">{t("views.submitted")}</TabsTrigger>
          <TabsTrigger value="all">{t("views.all")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-2">
        <Select
          value={filters.status}
          onValueChange={(value) =>
            syncUrl({ ...filters, status: value as RequestsPageFilters["status"] })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("filters.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
            {REQUEST_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {tEnums(`unitRequestStatus.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.type}
          onValueChange={(value) =>
            syncUrl({ ...filters, type: value as RequestsPageFilters["type"] })
          }
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t("filters.type")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allTypes")}</SelectItem>
            {REQUEST_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {tEnums(`unitRequestType.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.project === "all" ? "all" : projectNameToSlug(filters.project)}
          onValueChange={(slug) =>
            syncUrl({
              ...filters,
              project:
                slug === "all"
                  ? "all"
                  : projects.find((p) => projectNameToSlug(p) === slug) ?? "all",
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("filters.project")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allProjects")}</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project} value={projectNameToSlug(project)}>
                {project}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={filters.overdue === "yes" ? "default" : "outline"}
          size="sm"
          onClick={() =>
            syncUrl({
              ...filters,
              overdue: filters.overdue === "yes" ? "all" : "yes",
            })
          }
        >
          {t("filters.overdue")}
        </Button>
      </div>

      {isRequestsFilterActive(filters) ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <RemovableFilterChip
              key={chip.key}
              label={chip.label}
              onRemove={chip.onRemove}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              syncUrl({
                view: "awaiting",
                status: "all",
                type: "all",
                project: "all",
                overdue: "all",
              })
            }
          >
            {t("filters.clear")}
          </Button>
        </div>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.unit")}</TableHead>
              <TableHead>{t("columns.type")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>{t("columns.due")}</TableHead>
              <TableHead>{t("columns.requestedBy")}</TableHead>
              <TableHead className="text-end">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const overdue = isRequestOverdue({
                  status: row.status,
                  dueDate: row.dueDate ? new Date(row.dueDate) : null,
                });
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">
                        {row.projectName} · {row.unitCode}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.clientName}</div>
                    </TableCell>
                    <TableCell>{tEnums(`unitRequestType.${row.type}`)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">
                          {tEnums(`unitRequestStatus.${row.status}`)}
                        </Badge>
                        {row.escalatedToManagement ? (
                          <Badge variant="destructive">{t("escalated")}</Badge>
                        ) : null}
                        {overdue ? (
                          <Badge variant="destructive">{t("overdue")}</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className={cn(overdue && "text-destructive")}>
                      {row.dueDate
                        ? formatDateTime(row.dueDate, locale, { dateStyle: "medium" })
                        : "—"}
                    </TableCell>
                    <TableCell>{row.requestedByName}</TableCell>
                    <TableCell className="text-end">
                      <Button variant="outline" size="sm" render={<Link href={`/requests/${row.id}`} />}>
                        {t("open")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
