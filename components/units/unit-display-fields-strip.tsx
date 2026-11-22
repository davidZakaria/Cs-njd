"use client";

import { useTranslations } from "next-intl";
import { Calendar, FileSignature, Paintbrush } from "lucide-react";

import { useDomainLabels } from "@/hooks/use-domain-labels";
import {
  formatUnitDisplayDate,
  type SerializableUnitDisplayFields,
} from "@/lib/units/unit-display-fields";
import { cn } from "@/lib/utils";

export type UnitDisplayFieldsStripProps = {
  fields: SerializableUnitDisplayFields;
  locale: string;
  /** BEM-style surface tag for locale digit audits */
  surface?: string;
  className?: string;
  compact?: boolean;
};

export function UnitDisplayFieldsStrip({
  fields,
  locale,
  surface = "unit-display-fields",
  className,
  compact = false,
}: UnitDisplayFieldsStripProps) {
  const t = useTranslations("units.csSummary");
  const labels = useDomainLabels();

  const deliveryLabel = formatUnitDisplayDate(fields.deliveryDate, locale);
  const contractLabel = formatUnitDisplayDate(fields.saleContractDate, locale);
  const finishingLabel = fields.finishingType
    ? labels.finishingType(fields.finishingType)
    : null;

  const itemClass = compact
    ? "flex min-w-0 flex-1 items-center gap-2 text-xs sm:text-sm"
    : "flex min-w-0 flex-1 items-start gap-2 text-sm";

  return (
    <div
      data-locale-digit-surface={surface}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:gap-4",
        className
      )}
    >
      <div className={itemClass}>
        <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0">
          <span className="font-medium text-muted-foreground">{t("deliveryDate")}: </span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              deliveryLabel ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {deliveryLabel ?? t("notSet")}
          </span>
        </p>
      </div>
      <div className={itemClass}>
        <FileSignature className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0">
          <span className="font-medium text-muted-foreground">{t("contractDate")}: </span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              contractLabel ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {contractLabel ?? t("notSet")}
          </span>
        </p>
      </div>
      <div className={itemClass}>
        <Paintbrush className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0">
          <span className="font-medium text-muted-foreground">{t("finishingType")}: </span>
          <span
            className={cn(
              "font-semibold",
              finishingLabel ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {finishingLabel ?? t("notSet")}
          </span>
        </p>
      </div>
    </div>
  );
}