import type { ExecutiveStats } from "@/lib/cases/executive-dashboard";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ExecutiveKpiKey =
  | "openTotal"
  | "unassigned"
  | "legal"
  | "engineering"
  | "myOpen"
  | "teamOpen";

export type StatItem = {
  key: ExecutiveKpiKey | string;
  label: string;
  value: number;
  href?: string;
};

const KPI_TONE_CLASS: Record<ExecutiveKpiKey, string> = {
  openTotal: "border-s-2 border-s-[var(--color-chart-1)]",
  unassigned: "border-s-2 border-s-[var(--color-chart-2)]",
  legal: "border-s-2 border-s-[var(--color-chart-3)]",
  engineering: "border-s-2 border-s-[var(--color-chart-4)]",
  myOpen: "border-s-2 border-s-[var(--color-chart-5)]",
  teamOpen: "border-s-2 border-s-[var(--color-chart-1)]/60",
};

export function buildExecutiveKpiItems(
  stats: ExecutiveStats,
  labels: Record<ExecutiveKpiKey, string>,
  hrefs?: Partial<Record<ExecutiveKpiKey, string>>
): StatItem[] {
  return (
    [
      "openTotal",
      "unassigned",
      "legal",
      "engineering",
      "myOpen",
      "teamOpen",
    ] as const
  ).map((key) => ({
    key,
    label: labels[key],
    value: stats[key],
    href: hrefs?.[key],
  }));
}

export function ExecutiveKpiGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map((stat) => {
        const toneClass =
          stat.key in KPI_TONE_CLASS
            ? KPI_TONE_CLASS[stat.key as ExecutiveKpiKey]
            : "border-s-2 border-s-muted-foreground/30";

        const card = (
          <Card
            className={cn(
              "bg-card/80 shadow-sm transition-shadow hover:shadow-md",
              toneClass,
              stat.href && "cursor-pointer hover:ring-1 hover:ring-foreground/10"
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums tracking-tight">
                {stat.value.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        );

        return stat.href ? (
          <Link key={stat.key} href={stat.href} className="block">
            {card}
          </Link>
        ) : (
          <div key={stat.key}>{card}</div>
        );
      })}
    </div>
  );
}
