"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/format/currency";
import type { FlaggedFinishingUnit } from "@/lib/executive/financial-analytics";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ExecutiveFinanceDataCheck({
  flaggedUnits,
}: {
  flaggedUnits: FlaggedFinishingUnit[];
}) {
  const locale = useLocale();
  const t = useTranslations("executive.financeDataCheck");
  const tReasons = useTranslations("executive.financeDataCheck.reasons");

  if (flaggedUnits.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-lg">{t("title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("project")}</TableHead>
                <TableHead>{t("unitCode")}</TableHead>
                <TableHead className="text-end tabular-nums">{t("area")}</TableHead>
                <TableHead className="text-end tabular-nums">
                  {t("totalFinishing")}
                </TableHead>
                <TableHead className="text-end tabular-nums">{t("doorFees")}</TableHead>
                <TableHead className="text-end tabular-nums">
                  {t("aluminumFees")}
                </TableHead>
                <TableHead>{t("reasonsColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flaggedUnits.map((row) => (
                <TableRow key={row.unitId}>
                  <TableCell>{row.project}</TableCell>
                  <TableCell>
                    <Link
                      href={`/units/${row.unitId}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {row.unitCode}
                    </Link>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {row.area ?? "—"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCurrency(row.totalFinishingPrice ?? 0, locale)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCurrency(row.doorFees ?? 0, locale)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCurrency(row.aluminumFees ?? 0, locale)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.reasons.map((reason) => (
                        <Badge key={reason} variant="outline" className="text-xs">
                          {tReasons(reason)}
                        </Badge>
                      ))}
                      {!row.includeTotalInSum ? (
                        <Badge variant="secondary" className="text-xs">
                          {t("excludedFromFinishingTotal")}
                        </Badge>
                      ) : null}
                      {!row.includeDoorInSum && (row.doorFees ?? 0) > 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          {t("excludedFromDoorFees")}
                        </Badge>
                      ) : null}
                      {!row.includeAluminumInSum && (row.aluminumFees ?? 0) > 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          {t("excludedFromAluminumFees")}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
