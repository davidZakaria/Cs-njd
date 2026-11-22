"use client";

import { useTranslations } from "next-intl";

import { useDomainLabels } from "@/hooks/use-domain-labels";
import {
  formatUnitDisplayDate,
  type SerializableUnitDisplayFields,
} from "@/lib/units/unit-display-fields";
import { cn } from "@/lib/utils";

export function UnitDisplayFieldsCompactLine({
  fields,
  locale,
  className,
  maxWidthClass = "max-w-[14rem]",
}: {
  fields: SerializableUnitDisplayFields;
  locale: string;
  className?: string;
  /** Narrower for dense tables at 1024px */
  maxWidthClass?: string;
}) {
  const t = useTranslations("units.displayFieldsCompact");
  const tSummary = useTranslations("units.csSummary");
  const labels = useDomainLabels();

  const delivery =
    formatUnitDisplayDate(fields.deliveryDate, locale) ?? tSummary("notSet");
  const contract =
    formatUnitDisplayDate(fields.saleContractDate, locale) ?? tSummary("notSet");
  const finishing = fields.finishingType
    ? labels.finishingType(fields.finishingType)
    : tSummary("notSet");

  const line = `${t("delivery")} ${delivery} · ${t("contract")} ${contract} · ${t("finishing")} ${finishing}`;

  return (
    <p
      className={cn(
        "truncate text-xs leading-snug text-muted-foreground whitespace-nowrap",
        maxWidthClass,
        className
      )}
      title={line}
    >
      {line}
    </p>
  );
}