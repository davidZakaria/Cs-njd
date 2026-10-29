"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { OperationsProjectSummaryRow } from "@/lib/operations/operations-project-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OperationsProgressBar } from "@/components/operations/operations-progress-bar";
import { OPERATIONS_PROGRESS_ITEM_KEYS } from "@/lib/operations/operations-progress";

export function OperationsProjectSummaryBar({
  summaries,
}: {
  summaries: OperationsProjectSummaryRow[];
}) {
  const t = useTranslations("operations.summary");
  const tItems = useTranslations("operations.items");

  if (summaries.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">{t("title")}</h2>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {summaries.map((row) => (
          <Card key={row.project} className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{row.project}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("unitCount", { count: row.unitCount })}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {t("percentComplete", { percent: row.percentComplete })}
                </span>
                <OperationsProgressBar
                  doneCount={row.totalDoneCount}
                  applicableCount={row.totalApplicableCount}
                />
              </div>
              <ul className="space-y-1 text-sm">
                {OPERATIONS_PROGRESS_ITEM_KEYS.map((key) => {
                  const count = row.missingCounts[key];
                  if (count === 0) return null;
                  return (
                    <li key={key} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{tItems(key)}</span>
                      <Link
                        href={`/operations?project=${row.projectSlug}&missingItem=${key}`}
                        className="tabular-nums text-primary underline-offset-2 hover:underline"
                      >
                        {count}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
