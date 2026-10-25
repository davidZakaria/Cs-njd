import type { ExecutiveStats } from "@/lib/cases/executive-dashboard";
import { Link } from "@/i18n/navigation";
import {
  entranceAnimationClass,
  premiumCardHoverClass,
  staggerEntranceClass,
} from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ExecutiveKpiKey =
  | "openTotal"
  | "unassigned"
  | "legal"
  | "engineering"
  | "myOpen"
  | "teamOpen";

export type StatBreakdownItem = {
  key: string;
  label: string;
  value: number;
  href?: string;
};

export type StatItem = {
  key: ExecutiveKpiKey | string;
  label: string;
  value: number;
  href?: string;
  description?: string;
  percentOfTotal?: number;
  breakdown?: StatBreakdownItem[];
};

const KPI_TONE_CLASS: Record<ExecutiveKpiKey, string> = {
  openTotal: "border-s-2 border-s-[var(--color-chart-1)]",
  unassigned: "border-s-2 border-s-[var(--color-chart-2)]",
  legal: "border-s-2 border-s-[var(--color-chart-3)]",
  engineering: "border-s-2 border-s-[var(--color-chart-4)]",
  myOpen: "border-s-2 border-s-[var(--color-chart-5)]",
  teamOpen: "border-s-2 border-s-[var(--color-chart-1)]/60",
};

const RESOLVED_KPI_TONE_CLASS: Record<string, string> = {
  resolvedTotal: "border-s-2 border-s-emerald-500",
  myResolved: "border-s-2 border-s-emerald-500/70",
  teamResolved: "border-s-2 border-s-emerald-500/50",
};

const PORTFOLIO_KPI_TONE_CLASS: Record<string, string> = {
  totalUnits: "border-s-2 border-s-[var(--color-chart-1)]",
  deliveredUnits: "border-s-2 border-s-emerald-500",
  legalRiskUnits: "border-s-2 border-s-[var(--color-chart-3)]",
  deliveryOverdue: "border-s-2 border-s-[var(--color-chart-2)]",
  followUpDue: "border-s-2 border-s-[var(--color-chart-5)]",
  pendingWithParty: "border-s-2 border-s-[var(--color-chart-5)]/70",
  waitingOnAnotherParty: "border-s-2 border-s-[var(--color-chart-5)]/70",
  signedProtocolMissing: "border-s-2 border-s-[var(--color-chart-2)]/80",
  finishingInProgress: "border-s-2 border-s-[var(--color-chart-4)]",
  feesOutstanding: "border-s-2 border-s-[var(--color-chart-3)]/70",
};

export function buildExecutiveKpiItems(
  stats: ExecutiveStats,
  labels: Record<ExecutiveKpiKey, string>,
  hrefs?: Partial<Record<ExecutiveKpiKey, string>>,
  options?: { includeQueueSplit?: boolean }
): StatItem[] {
  const keys = [
    "openTotal",
    "unassigned",
    "legal",
    "engineering",
    ...(options?.includeQueueSplit ? (["myOpen", "teamOpen"] as const) : []),
  ] as const;

  return keys.map((key) => ({
    key,
    label: labels[key],
    value: stats[key],
    href: hrefs?.[key],
  }));
}

export function ExecutiveKpiGrid({ items }: { items: StatItem[] }) {
  return (
    <TooltipProvider>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map((stat, index) => {
        const toneClass =
          stat.key in KPI_TONE_CLASS
            ? KPI_TONE_CLASS[stat.key as ExecutiveKpiKey]
            : stat.key in PORTFOLIO_KPI_TONE_CLASS
              ? PORTFOLIO_KPI_TONE_CLASS[stat.key]
              : stat.key in RESOLVED_KPI_TONE_CLASS
                ? RESOLVED_KPI_TONE_CLASS[stat.key]
                : "border-s-2 border-s-muted-foreground/30";

        const hasBreakdown = (stat.breakdown?.length ?? 0) > 0;
        const mainLink = stat.href && !hasBreakdown;

        const card = (
          <Card
            className={cn(
              "group bg-card shadow-sm",
              premiumCardHoverClass,
              entranceAnimationClass,
              staggerEntranceClass(index),
              toneClass,
              mainLink && "cursor-pointer hover:ring-1 hover:ring-foreground/10"
            )}
          >
            <CardHeader className="pb-2">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <CardTitle className="cursor-help text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </CardTitle>
                  }
                />
                {stat.description ? (
                  <TooltipContent side="top" className="max-w-xs text-start">
                    {stat.description}
                  </TooltipContent>
                ) : null}
              </Tooltip>
            </CardHeader>
            <CardContent className="space-y-2">
              {stat.href && hasBreakdown ? (
                <Link
                  href={stat.href}
                  className="block font-heading text-3xl font-bold tabular-nums tracking-tight underline-offset-2 hover:underline"
                >
                  {stat.value.toLocaleString()}
                </Link>
              ) : (
                <div className="font-heading text-3xl font-bold tabular-nums tracking-tight transition-transform duration-300 group-hover:scale-[1.02]">
                  {stat.value.toLocaleString()}
                </div>
              )}
              {stat.percentOfTotal != null && stat.percentOfTotal > 0 ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {stat.percentOfTotal.toFixed(1)}%
                </p>
              ) : null}
              {hasBreakdown ? (
                <ul className="space-y-0.5 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  {stat.breakdown!.map((line) => (
                    <li
                      key={line.key}
                      className="flex items-baseline justify-between gap-2 tabular-nums"
                    >
                      <span className="truncate">{line.label}</span>
                      {line.href ? (
                        <Link
                          href={line.href}
                          className="shrink-0 font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          {line.value.toLocaleString()}
                        </Link>
                      ) : (
                        <span className="shrink-0 font-medium text-foreground">
                          {line.value.toLocaleString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        );

        return mainLink ? (
          <Link key={stat.key} href={stat.href!} className="block">
            {card}
          </Link>
        ) : (
          <div key={stat.key}>{card}</div>
        );
      })}
    </div>
    </TooltipProvider>
  );
}
