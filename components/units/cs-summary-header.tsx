"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { 
  Crown, 
  User, 
  Users,
  Building2, 
  Clock, 
  Calendar, 
  FileSignature, 
  Paintbrush 
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  isMergedOwnerName,
  extractPrimaryOwnerName,
  extractCoOwnerName,
} from "@/lib/utils/arabic-normalize";
import { formatUnitDisplayDate } from "@/lib/units/unit-display-fields";
import { formatGracePeriodLabel } from "@/lib/format/grace-period-display";
import { formatLocaleMessageNumber } from "@/lib/format/locale-display";
import { LocaleIdentifierText } from "@/components/phone/phone-ltr";

export type CsSummaryHeaderProps = {
  clientName: string;
  /** Separate co-owner when unit uses unitClients (not merged "/" primary name). */
  coOwnerDisplayName?: string | null;
  unitCode: string;
  projectName: string;
  gracePeriod: string | null;
  deliveryDate: string | null;
  contractDate: string | null;
  finishingType: string | null;
  locale: string;
  primaryMultiUnitBadge?: {
    unitCount: number;
    units: Array<{
      id: string;
      unitCode: string;
      projectName: string;
      isCurrent: boolean;
    }>;
  } | null;
  coOwnerMultiUnitBadge?: {
    unitCount: number;
    units: Array<{
      id: string;
      unitCode: string;
      projectName: string;
      isCurrent: boolean;
    }>;
  } | null;
};

type GraceStatus = "active" | "expiring" | "expired" | "unknown";

function parseGraceStatus(gracePeriod: string | null): GraceStatus {
  if (!gracePeriod) return "unknown";
  
  const lower = gracePeriod.toLowerCase();
  
  if (lower.includes("expired") || lower.includes("منتهية")) {
    return "expired";
  }
  if (lower.includes("expiring") || lower.includes("soon") || lower.includes("قريباً")) {
    return "expiring";
  }
  if (lower.includes("active") || lower.includes("نشطة") || lower.includes("until") || lower.includes("حتى")) {
    return "active";
  }
  
  const dateMatch = gracePeriod.match(/\d{4}/);
  if (dateMatch) {
    const year = parseInt(dateMatch[0], 10);
    const now = new Date();
    const currentYear = now.getFullYear();
    
    if (year < currentYear) return "expired";
    if (year === currentYear) {
      const monthMatch = gracePeriod.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
      if (monthMatch) {
        const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const monthIndex = months.indexOf(monthMatch[1].toLowerCase());
        const currentMonth = now.getMonth();
        if (monthIndex < currentMonth) return "expired";
        if (monthIndex <= currentMonth + 2) return "expiring";
      }
      return "expiring";
    }
    return "active";
  }
  
  return "unknown";
}

function GraceStatusChip({ status, label }: { status: GraceStatus; label: string }) {
  const statusStyles = {
    active: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700",
    expiring: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700",
    expired: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700",
    unknown: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
  };

  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold",
      statusStyles[status]
    )}>
      {label}
    </span>
  );
}

type MultiUnitBadgeData = NonNullable<
  CsSummaryHeaderProps["primaryMultiUnitBadge"]
>;

type MultiUnitBadgeProps = {
  badge: MultiUnitBadgeData;
  t: ReturnType<typeof useTranslations>;
  labels: ReturnType<typeof useDomainLabels>;
};

function MultiUnitBadgeDisplay({
  badge,
  t,
  labels,
  locale,
}: MultiUnitBadgeProps & { locale: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1.5 bg-amber-500 px-3 py-1 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              <Crown className="h-4 w-4" />
              {t("multiUnit", {
                count: formatLocaleMessageNumber(badge.unitCount, locale),
              })}
            </Badge>
          }
        />
        <TooltipContent side="bottom" className="max-w-xs p-4">
          <div className="space-y-3">
            <p className="font-semibold text-foreground">
              {t("multiUnitTooltip", {
                count: formatLocaleMessageNumber(badge.unitCount, locale),
              })}
            </p>
            <ul className="space-y-2">
              {badge.units.map((u) => (
                <li key={u.id}>
                  {u.isCurrent ? (
                    <div className="flex flex-wrap items-center gap-2 text-foreground">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <LocaleIdentifierText kind="unitCode" className="font-medium">
                        {u.unitCode}
                      </LocaleIdentifierText>
                      <span className="text-muted-foreground">·</span>
                      <span>{labels.project(u.projectName)}</span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {t("multiUnitCurrentUnit")}
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={`/units/${u.id}`}
                      className="flex items-center gap-2 text-primary underline-offset-2 hover:underline"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      <LocaleIdentifierText kind="unitCode" className="font-medium">
                        {u.unitCode}
                      </LocaleIdentifierText>
                      <span className="text-muted-foreground">·</span>
                      <span>{labels.project(u.projectName)}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CsSummaryHeader({
  clientName,
  coOwnerDisplayName,
  unitCode,
  projectName,
  gracePeriod,
  deliveryDate,
  contractDate,
  finishingType,
  locale,
  primaryMultiUnitBadge,
  coOwnerMultiUnitBadge,
}: CsSummaryHeaderProps) {
  const t = useTranslations("units.csSummary");
  const labels = useDomainLabels();

  const formatSummaryDate = (dateStr: string | null) =>
    formatUnitDisplayDate(dateStr, locale);

  const graceDisplay = formatGracePeriodLabel(gracePeriod, locale, (month, year) =>
    t("graceActiveUntil", { month, year })
  );
  const graceStatus = parseGraceStatus(gracePeriod);
  const hasClient = clientName && clientName.length > 0;
  const hasMergedOwners = isMergedOwnerName(clientName);
  const primaryOwnerName = hasMergedOwners ? extractPrimaryOwnerName(clientName) : clientName;
  const coOwnerName = hasMergedOwners
    ? extractCoOwnerName(clientName)
  : coOwnerDisplayName?.trim()
    ? coOwnerDisplayName.trim()
    : null;
  const showDualOwners = Boolean(coOwnerName);

  return (
    <Card
      data-locale-digit-surface="cs-summary"
      className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 shadow-lg dark:border-primary/30 dark:from-primary/10 dark:via-background dark:to-primary/5"
    >
      <CardContent className="p-0">
        {/* Client Header Section */}
        <div className="border-b border-primary/10 bg-primary/5 px-6 py-4 dark:bg-primary/10">
          <div className="flex flex-wrap items-center gap-3">
            {showDualOwners ? (
              <Users className="h-6 w-6 text-primary dark:text-primary" />
            ) : (
              <User className="h-6 w-6 text-primary dark:text-primary" />
            )}
            <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {showDualOwners ? t("owners") : t("clientName")}
            </span>
          </div>
          
          {showDualOwners && coOwnerName ? (
            <div className="mt-2 space-y-2">
              {/* Primary Owner */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {t("primaryOwner")}
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {primaryOwnerName}
                </h2>
                {primaryMultiUnitBadge && primaryMultiUnitBadge.unitCount > 1 ? (
                  <MultiUnitBadgeDisplay
                    badge={primaryMultiUnitBadge}
                    t={t}
                    labels={labels}
                    locale={locale}
                  />
                ) : null}
              </div>
              {/* Co-Owner */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  {t("coOwner")}
                </span>
                <h3 className="text-xl font-semibold tracking-tight text-foreground/90 sm:text-2xl">
                  {coOwnerName}
                </h3>
                {coOwnerMultiUnitBadge && coOwnerMultiUnitBadge.unitCount > 1 ? (
                  <MultiUnitBadgeDisplay
                    badge={coOwnerMultiUnitBadge}
                    t={t}
                    labels={labels}
                    locale={locale}
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className={cn(
                "text-2xl font-bold tracking-tight sm:text-3xl",
                hasClient ? "text-foreground" : "text-muted-foreground"
              )}>
                {hasClient ? clientName : t("notSet")}
              </h2>
            {primaryMultiUnitBadge && primaryMultiUnitBadge.unitCount > 1 ? (
                <MultiUnitBadgeDisplay
                  badge={primaryMultiUnitBadge}
                  t={t}
                  labels={labels}
                  locale={locale}
                />
              ) : null}
            </div>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Unit */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 dark:bg-primary/20">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("unit")}
              </span>
              <LocaleIdentifierText
                kind="unitCode"
                className="text-lg font-bold text-foreground"
              >
                {unitCode}
              </LocaleIdentifierText>
              <span className="ml-1 text-muted-foreground">·</span>
              <span className="ml-1 font-medium text-muted-foreground">
                {labels.project(projectName)}
              </span>
            </div>
          </div>

          {/* Grace Period */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 dark:bg-primary/20">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("gracePeriod")}
              </span>
              <div className="mt-1">
                {graceDisplay ? (
                  <GraceStatusChip status={graceStatus} label={graceDisplay} />
                ) : (
                  <span className="text-lg font-bold text-muted-foreground">{t("notSet")}</span>
                )}
              </div>
            </div>
          </div>

          {/* Delivery Date */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 dark:bg-primary/20">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("deliveryDate")}
              </span>
              <span className={cn(
                "text-lg font-bold",
                formatSummaryDate(deliveryDate) ? "text-foreground" : "text-muted-foreground"
              )}>
                {formatSummaryDate(deliveryDate) ?? t("notSet")}
              </span>
            </div>
          </div>

          {/* Contract Date */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 dark:bg-primary/20">
              <FileSignature className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("contractDate")}
              </span>
              <span className={cn(
                "text-lg font-bold",
                formatSummaryDate(contractDate) ? "text-foreground" : "text-muted-foreground"
              )}>
                {formatSummaryDate(contractDate) ?? t("notSet")}
              </span>
            </div>
          </div>

          {/* Finishing Type */}
          <div className="flex items-start gap-3 sm:col-span-2 lg:col-span-1">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 dark:bg-primary/20">
              <Paintbrush className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("finishingType")}
              </span>
              <span className={cn(
                "text-lg font-bold",
                finishingType ? "text-foreground" : "text-muted-foreground"
              )}>
                {finishingType ? labels.finishingType(finishingType) : t("notSet")}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
