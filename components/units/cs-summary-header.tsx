"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { Star } from "lucide-react";
import { Link } from "@/i18n/navigation";

export type CsSummaryHeaderProps = {
  clientName: string;
  unitCode: string;
  projectName: string;
  gracePeriod: string | null;
  deliveryDate: string | null;
  contractDate: string | null;
  finishingType: string | null;
  locale: string;
  multiUnitBadge?: {
    unitCount: number;
    otherUnits: Array<{ id: string; unitCode: string; projectName: string }>;
  } | null;
};

export function CsSummaryHeader({
  clientName,
  unitCode,
  projectName,
  gracePeriod,
  deliveryDate,
  contractDate,
  finishingType,
  locale,
  multiUnitBadge,
}: CsSummaryHeaderProps) {
  const t = useTranslations("units.csSummary");
  const labels = useDomainLabels();

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t("notSet");
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="pt-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Client Name */}
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("clientName")}
              </span>
              <span className="text-lg font-semibold">{clientName || t("notSet")}</span>
              {multiUnitBadge && multiUnitBadge.unitCount > 1 ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge
                        variant="secondary"
                        className="inline-flex cursor-pointer items-center gap-1 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-200"
                      >
                        <Star className="h-3 w-3 fill-current" />
                        {t("multiUnit", { count: multiUnitBadge.unitCount })}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-medium">
                          {t("multiUnitTooltip", { count: multiUnitBadge.unitCount })}
                        </p>
                        <ul className="space-y-1 text-sm">
                          {multiUnitBadge.otherUnits.map((u) => (
                            <li key={u.id}>
                              <Link
                                href={`/units/${u.id}`}
                                className="text-primary underline hover:no-underline"
                              >
                                {u.unitCode} · {labels.project(u.projectName)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
          </div>

          {/* Unit */}
          <div>
            <span className="block text-sm font-medium text-muted-foreground">
              {t("unit")}
            </span>
            <span className="text-base font-medium">
              {unitCode} · {labels.project(projectName)}
            </span>
          </div>

          {/* Grace Period */}
          <div>
            <span className="block text-sm font-medium text-muted-foreground">
              {t("gracePeriod")}
            </span>
            <span className="text-base">
              {gracePeriod || t("notSet")}
            </span>
          </div>

          {/* Delivery Date */}
          <div>
            <span className="block text-sm font-medium text-muted-foreground">
              {t("deliveryDate")}
            </span>
            <span className="text-base">
              {formatDate(deliveryDate)}
            </span>
          </div>

          {/* Contract Date */}
          <div>
            <span className="block text-sm font-medium text-muted-foreground">
              {t("contractDate")}
            </span>
            <span className="text-base">
              {formatDate(contractDate)}
            </span>
          </div>

          {/* Finishing Type */}
          <div>
            <span className="block text-sm font-medium text-muted-foreground">
              {t("finishingType")}
            </span>
            <span className="text-base">
              {finishingType ? labels.finishingType(finishingType) : t("notSet")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
