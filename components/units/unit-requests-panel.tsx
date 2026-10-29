import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UnitRequest } from "@prisma/client";

export async function UnitRequestsPanel({
  unitId,
  requests,
  locale,
}: {
  unitId: string;
  requests: Array<
    Pick<UnitRequest, "id" | "type" | "status" | "dueDate" | "unitCycleStageKey"> & {
      requestedBy: { name: string };
    }
  >;
  locale: string;
}) {
  const t = await getTranslations("requests.unitPanel");
  const tEnums = await getTranslations({ locale, namespace: "enums" });

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          <Button className="mt-3" size="sm" variant="outline" render={<Link href="/requests" />}>
            {t("create")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <Button size="sm" variant="outline" render={<Link href="/requests" />}>
          {t("viewAll")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {requests.slice(0, 8).map((request) => (
          <Link
            key={request.id}
            href={`/requests/${request.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 hover:bg-muted/40"
          >
            <div>
              <p className="font-medium">
                {tEnums(`unitRequestType.${request.type}`)}
              </p>
              <p className="text-xs text-muted-foreground">
                {request.requestedBy.name}
              </p>
            </div>
            <Badge variant="outline">
              {tEnums(`unitRequestStatus.${request.status}`)}
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
