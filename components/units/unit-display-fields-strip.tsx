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
  /** Single wrapped line for request detail (no card chrome). */
  layout?: "panel" | "inline";
};

export function UnitDisplayFieldsStrip({
  fields,
  locale,
  surface = "unit-display-fields",
  className,
  compact = false,
  layout = "panel",
}: UnitDisplayFieldsStripProps) {
  const t = useTranslations("units.csSummary");
  const tCompact = useTranslations("units.displayFieldsCompact");
  const labels = useDomainLabels();

  const deliveryLabel = formatUnitDisplayDate(fields.deliveryDate, locale);
  const contractLabel = formatUnitDisplayDate(fields.saleContractDate, locale);
  const finishingLabel = fields.finishingType
    ? labels.finishingType(fields.finishingType)
    : null;

  if (layout === "inline") {
    const delivery = deliveryLabel ?? t("notSet");
    const contract = contractLabel ?? t("notSet");
    const finishing = finishingLabel ?? t("notSet");
    const line = `${tCompact("delivery")} ${delivery} · ${tCompact("contract")} ${contract} · ${tCompact("finishing")} ${finishing}`;
    return (
      <p
        data-locale-digit-surface={surface}
        className={cn("text-sm leading-relaxed text-muted-foreground", className)}
        title={line}
      >
        <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5">
          <span className="whitespace-nowrap">
            {tCompact("delivery")}{" "}
            <span className="font-medium text-foreground tabular-nums">{delivery}</span>
          </span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <span className="whitespace-nowrap">
            {tCompact("contract")}{" "}
            <span className="font-medium text-foreground tabular-nums">{contract}</span>
          </span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <span className="whitespace-nowrap">
            {tCompact("finishing")}{" "}
            <span className="font-medium text-foreground">{finishing}</span>
          </span>
        </span>
      </p>
    );
  }

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