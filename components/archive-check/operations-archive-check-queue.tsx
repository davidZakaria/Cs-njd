import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ArchiveCheckQueueRow } from "@/lib/archive-check/queries";

export async function OperationsArchiveCheckQueue({
  rows,
}: {
  rows: ArchiveCheckQueueRow[];
}) {
  const t = await getTranslations("archiveCheck.operations");
  const locale = await getLocale();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("queueTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("queueEmpty")}</p>
        ) : (
          rows.map((row) => (
            <Link
              key={row.id}
              href={`/operations/archive-checks/${row.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/40"
            >
              <div>
                <p className="font-medium">
                  {row.projectName} · {row.unitCode}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("requestedBy", { name: row.requestedByName })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {t("itemsPending", {
                    pending: row.pendingItemCount,
                    total: row.itemCount,
                  })}
                </Badge>
                {row.dueDate ? (
                  <Badge variant="outline">
                    {new Date(row.dueDate).toLocaleDateString(locale)}
                  </Badge>
                ) : null}
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
