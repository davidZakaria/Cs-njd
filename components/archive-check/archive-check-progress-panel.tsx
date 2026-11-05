"use client";

import { useTranslations } from "next-intl";

import {
  buildArchiveCheckProgressItems,
  summarizeArchiveCheckProgress,
  type ArchiveCheckGapTaskProgress,
} from "@/lib/archive-check/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ArchiveCheckItemStatus, ArchiveCheckGapTaskStatus } from "@prisma/client";

type UnitProgressBlock = {
  unitCode: string;
  projectName: string;
  items: Array<{ itemKey: string; status: ArchiveCheckItemStatus }>;
  gapTasks: ArchiveCheckGapTaskProgress[];
};

export function ArchiveCheckProgressPanel({
  bulkProjectName,
  units,
}: {
  bulkProjectName?: string | null;
  units: UnitProgressBlock[];
}) {
  const t = useTranslations("archiveCheck.progress");
  const tItems = useTranslations("operations.items");
  const tDept = useTranslations("enums.unitRequestApproverKind");

  const allProgress = units.flatMap((unit) =>
    buildArchiveCheckProgressItems({
      items: unit.items,
      gapTasks: unit.gapTasks,
    }).map((item) => ({ ...item, unitCode: unit.unitCode, projectName: unit.projectName }))
  );
  const summary = summarizeArchiveCheckProgress(allProgress);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        {bulkProjectName ? (
          <p className="text-sm text-muted-foreground">
            {t("bulkProjectLabel", { project: bulkProjectName })}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {t("overallCount", {
            done: summary.doneCount,
            total: summary.totalCount,
          })}
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("unitColumn")}</TableHead>
              <TableHead>{t("itemColumn")}</TableHead>
              <TableHead>{t("statusColumn")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allProgress.map((row) => (
              <TableRow key={`${row.unitCode}-${row.itemKey}`}>
                <TableCell>
                  {row.projectName} · {row.unitCode}
                </TableCell>
                <TableCell>{tItems(row.itemKey)}</TableCell>
                <TableCell>
                  {row.displayStatus === "done" ? (
                    <Badge variant="secondary">{t("done")}</Badge>
                  ) : row.displayStatus === "being_fixed" ? (
                    <Badge>
                      {t("beingFixed", {
                        department: row.fixingDepartment
                          ? tDept(row.fixingDepartment)
                          : tDept("MANAGEMENT"),
                      })}
                    </Badge>
                  ) : row.displayStatus === "not_checked" ? (
                    <Badge variant="outline">{t("notChecked")}</Badge>
                  ) : (
                    <Badge variant="destructive">{t("missing")}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
