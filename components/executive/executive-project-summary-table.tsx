"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { buildCasesFilterUrl } from "@/lib/cases/cases-filter-url";
import { buildUnitsFilterUrl } from "@/lib/units/units-filter-url";
import type { ExecutiveProjectUnitSummary } from "@/lib/executive/project-unit-summaries";
import type { ProjectDashboardSlice } from "@/lib/cases/executive-dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ExecutiveProjectSummaryTable({
  summaries,
  byProject,
  portfolioTotalUnits,
}: {
  summaries: ExecutiveProjectUnitSummary[];
  byProject: ProjectDashboardSlice[];
  portfolioTotalUnits: number;
}) {
  const t = useTranslations("executive.projectSummary");
  const labels = useDomainLabels();

  const rows = useMemo(() => {
    const openBySlug = new Map(
      byProject.map((slice) => [slice.slug, slice.stats.openTotal])
    );
    return summaries.map((row) => ({
      ...row,
      unitsWithOpenWork: openBySlug.get(row.slug) ?? 0,
    }));
  }, [byProject, summaries]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          totalUnits: acc.totalUnits + row.totalUnits,
          unitsWithOpenWork: acc.unitsWithOpenWork + row.unitsWithOpenWork,
          deliveredUnits: acc.deliveredUnits + row.deliveredUnits,
          deliveryOverdue: acc.deliveryOverdue + row.deliveryOverdue,
          unassignedUnits: acc.unassignedUnits + row.unassignedUnits,
        }),
        {
          totalUnits: 0,
          unitsWithOpenWork: 0,
          deliveredUnits: 0,
          deliveryOverdue: 0,
          unassignedUnits: 0,
        }
      ),
    [rows]
  );

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="font-heading text-lg">{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="text-xs text-muted-foreground">{t("tabBadgeHint")}</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("project")}</TableHead>
              <TableHead className="text-end tabular-nums">{t("totalUnits")}</TableHead>
              <TableHead className="text-end tabular-nums">{t("openWork")}</TableHead>
              <TableHead className="text-end tabular-nums">{t("delivered")}</TableHead>
              <TableHead className="text-end tabular-nums">{t("overdue")}</TableHead>
              <TableHead className="text-end tabular-nums">{t("unassigned")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.projectId}>
                <TableCell className="font-medium">
                  {labels.project(row.projectName)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  <Link
                    href={buildUnitsFilterUrl({ project: row.slug })}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.totalUnits.toLocaleString()}
                  </Link>
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  <Link
                    href={buildCasesFilterUrl({
                      status: "open",
                      project: row.slug,
                    })}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.unitsWithOpenWork.toLocaleString()}
                  </Link>
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  <Link
                    href={buildUnitsFilterUrl({
                      project: row.slug,
                      handover: "delivered",
                    })}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.deliveredUnits.toLocaleString()}
                  </Link>
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  <Link
                    href={buildUnitsFilterUrl({
                      project: row.slug,
                      delivery: "overdue",
                    })}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.deliveryOverdue.toLocaleString()}
                  </Link>
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  <Link
                    href={buildUnitsFilterUrl({
                      project: row.slug,
                      agent: "unassigned",
                    })}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.unassignedUnits.toLocaleString()}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-semibold">
              <TableCell>{t("portfolioTotal")}</TableCell>
              <TableCell className="text-end tabular-nums">
                <Link href="/units" className="underline-offset-2 hover:underline">
                  {portfolioTotalUnits.toLocaleString()}
                </Link>
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {totals.unitsWithOpenWork.toLocaleString()}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {totals.deliveredUnits.toLocaleString()}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {totals.deliveryOverdue.toLocaleString()}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {totals.unassignedUnits.toLocaleString()}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        {totals.totalUnits !== portfolioTotalUnits ? (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            {t("reconcileWarning", {
              rowSum: totals.totalUnits,
              portfolioTotal: portfolioTotalUnits,
            })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
