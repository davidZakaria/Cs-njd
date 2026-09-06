"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import type { AgentKPIRow } from "@/lib/cases/kpi-types";
import { projectBarFill } from "@/lib/executive/chart-theme";
import { premiumCardHoverClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";

export function PerformanceActivityChart({ rows }: { rows: AgentKPIRow[] }) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const t = useTranslations("performance");
  const tCharts = useTranslations("executive.charts");

  const chartData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.activityCount - a.activityCount)
        .map((row, index) => ({
          key: row.agentId,
          label: row.agentName,
          count: row.activityCount,
          fill: projectBarFill(index),
        })),
    [rows]
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
    <Card className={cn(premiumCardHoverClass)}>
      <CardHeader>
        <CardTitle>{t("activityChartTitle")}</CardTitle>
        <CardDescription>{t("activityChartDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {tCharts("noData")}
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[280px] w-full"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 8, right: isRtl ? 4 : 12, left: isRtl ? 12 : 4 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                reversed={isRtl}
                interval={0}
                angle={chartData.length > 4 ? -28 : 0}
                textAnchor={chartData.length > 4 ? "end" : "middle"}
                height={chartData.length > 4 ? 72 : 40}
                className="text-[11px]"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                allowDecimals={false}
                orientation={isRtl ? "right" : "left"}
                width={36}
              />
              <ChartTooltip
                cursor={{ fill: "var(--color-muted)", opacity: 0.35 }}
                content={
                  <ChartTooltipContent
                    labelKey="label"
                    nameKey="count"
                    formatter={(value) => (
                      <span className="font-mono font-medium tabular-nums">
                        {value} {tCharts("count")}
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
