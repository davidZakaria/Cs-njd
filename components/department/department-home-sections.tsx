import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UnitRequestListRow } from "@/lib/requests/types";
import { cn } from "@/lib/utils";

export async function DepartmentAwaitingRequestsQueue({
  rows,
  viewAllHref,
}: {
  rows: UnitRequestListRow[];
  viewAllHref: string;
}) {
  const t = await getTranslations("departmentHome");
  const tEnums = await getTranslations("enums");
  const locale = await getLocale();

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-lg">{t("awaitingTitle")}</CardTitle>
        <Link href={viewAllHref} className="text-sm font-medium text-[var(--color-chart-1)]">
          {t("viewAllRequests")}
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("awaitingEmpty")}</p>
        ) : (
          rows.slice(0, 12).map((row) => (
            <Link
              key={row.id}
              href={`/requests/${row.id}`}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/40"
              )}
            >
              <div>
                <p className="font-medium">
                  {row.projectName} · {row.unitCode}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tEnums(`unitRequestType.${row.type}`)}
                </p>
              </div>
              {row.dueDate ? (
                <Badge variant="outline">
                  {row.dueDate.toLocaleDateString(locale)}
                </Badge>
              ) : null}
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
