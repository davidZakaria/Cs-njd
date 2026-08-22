"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Cell, Label, Pie, PieChart } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CategoryBreakdown } from "@/lib/cases/executive-dashboard";
import { buildCasesFilterUrl } from "@/lib/cases/cases-filter-url";
import {
  categoryBreakdownToSlices,
  categoryChartKeyToFilter,
  type CategoryChartKey,
} from "@/lib/executive/chart-theme";

type StatusDonutChartProps = {
  breakdown: CategoryBreakdown;
  title?: string;
  description?: string;
  className?: string;
  statusScope?: "open" | "RESOLVED";
  projectSlug?: string;
};

export function StatusDonutChart({
  breakdown,
  title,
  description,
  className,
  statusScope = "open",
  projectSlug,
}: StatusDonutChartProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const router = useRouter();
  const tCharts = useTranslations("executive.charts");
  const tStats = useTranslations("executive.stats");

  const categoryLabels = useMemo(
    () =>
      ({
        legal: tStats("legal"),
        engineering: tStats("engineering"),
        customerService: tStats("customerService"),
        feedbackHistory: tCharts("feedbackHistory"),
        general: tCharts("general"),
      }) satisfies Record<CategoryChartKey, string>,
    [tCharts, tStats]
  );

  const slices = useMemo(
    () => categoryBreakdownToSlices(breakdown, categoryLabels),
    [breakdown, categoryLabels]
  );

  const chartConfig = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        slices.map((slice) => [
          slice.key,
          { label: slice.label, color: slice.fill },
        ])
      ),
    [slices]
  );

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  function handleSliceClick(key: CategoryChartKey) {
    router.push(
      buildCasesFilterUrl(
        categoryChartKeyToFilter(key, {
          statusScope,
          project: projectSlug,
        })
      )
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title ?? tCharts("categoryShare")}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {tCharts("noData")}
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[300px] w-full"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    nameKey="key"
                    formatter={(value, _name, item) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {item.payload?.label as string}
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {value} ({Math.round((Number(value) / total) * 100)}%)
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Pie
                data={slices}
                dataKey="value"
                nameKey="key"
                innerRadius={68}
                outerRadius={96}
                paddingAngle={2}
                strokeWidth={2}
                stroke="var(--color-background)"
              >
                {slices.map((slice) => (
                  <Cell
                    key={slice.key}
                    fill={slice.fill}
                    className="cursor-pointer"
                    onClick={() => handleSliceClick(slice.key)}
                  />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                      return null;
                    }
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) - 6}
                          className="fill-foreground text-2xl font-semibold"
                        >
                          {total.toLocaleString(locale)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 16}
                          className="fill-muted-foreground text-xs"
                        >
                          {tCharts("openCases")}
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
              <ChartLegend
                verticalAlign="bottom"
                content={
                  <ChartLegendContent
                    className="flex flex-wrap justify-center gap-4"
                    nameKey="key"
                  />
                }
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
