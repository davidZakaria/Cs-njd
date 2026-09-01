"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { premiumCardHoverClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";
import { projectBarFill } from "@/lib/executive/chart-theme";
import type { FinishingPhaseSlice } from "@/lib/executive/portfolio-analytics";

type FinishingPipelineChartProps = {
  phases: FinishingPhaseSlice[];
  title?: string;
  description?: string;
  className?: string;
};

export function FinishingPipelineChart({
  phases,
  title,
  description,
  className,
}: FinishingPipelineChartProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const tExecutive = useTranslations("executive");
  const tCharts = useTranslations("executive.charts");
  const { finishingPhase } = useDomainLabels();

  const chartData = useMemo(
    () =>
      phases.map((slice, index) => ({
        key: slice.phase,
        label: finishingPhase(slice.phase),
        count: slice.count,
        fill: projectBarFill(index),
      })),
    [phases, finishingPhase]
  );

  const chartConfig = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        chartData.map((item) => [
          item.key,
          { label: item.label, color: item.fill },
        ])
      ),
    [chartData]
  );

  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className={cn(premiumCardHoverClass, className)}>
      <CardHeader>
        <CardTitle>{title ?? tExecutive("finishingPipelineChart")}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {tCharts("noPortfolioData")}
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[320px] w-full"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{
                top: 8,
                right: isRtl ? 12 : 24,
                left: isRtl ? 24 : 12,
                bottom: 8,
              }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                reversed={isRtl}
              />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={isRtl ? 140 : 120}
                orientation={isRtl ? "right" : "left"}
                className="text-[11px]"
              />
              <ChartTooltip
                cursor={{ fill: "var(--color-muted)", opacity: 0.35 }}
                content={
                  <ChartTooltipContent
                    labelKey="label"
                    nameKey="count"
                    formatter={(value) => (
                      <span className="font-mono font-medium tabular-nums">
                        {value} {tCharts("units")}
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
