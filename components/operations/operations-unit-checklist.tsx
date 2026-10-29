"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { OperationsProgressSummary } from "@/lib/operations/operations-progress";
import { unitTabHrefForProgressItem } from "@/lib/operations/operations-progress";
import { OperationsStatusBadge } from "@/components/operations/operations-status-badge";
import { OperationsProgressBar } from "@/components/operations/operations-progress-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OperationsUnitChecklist({
  unitId,
  unitCode,
  project,
  clientName,
  progress,
}: {
  unitId: string;
  unitCode: string;
  project: string;
  clientName: string;
  progress: OperationsProgressSummary;
}) {
  const t = useTranslations("operations");
  const tItems = useTranslations("operations.items");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{project}</p>
        <h1 className="font-heading text-2xl font-semibold">{unitCode}</h1>
        <p className="text-muted-foreground">{clientName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("detail.overall")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium">
            {t("progressLabel", {
              done: progress.doneCount,
              total: progress.applicableCount,
            })}
          </span>
          <OperationsProgressBar
            doneCount={progress.doneCount}
            applicableCount={progress.applicableCount}
            className="min-w-[10rem]"
          />
          <span className="text-sm text-muted-foreground">
            {t("detail.percent", { percent: progress.percentComplete })}
          </span>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("detail.item")}</TableHead>
              <TableHead>{t("detail.status")}</TableHead>
              <TableHead>{t("detail.action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {progress.items.map((item) => (
              <TableRow key={item.key}>
                <TableCell>{tItems(item.key)}</TableCell>
                <TableCell>
                  <OperationsStatusBadge status={item.status} />
                </TableCell>
                <TableCell>
                  {item.status === "not_applicable" ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <Link
                      href={unitTabHrefForProgressItem(item.key, unitId)}
                      className="text-sm text-primary underline-offset-2 hover:underline"
                    >
                      {t("detail.openTab")}
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Link
        href={`/units/${unitId}`}
        className="text-sm text-primary underline-offset-2 hover:underline"
      >
        {t("detail.openUnitProfile")}
      </Link>
    </div>
  );
}
