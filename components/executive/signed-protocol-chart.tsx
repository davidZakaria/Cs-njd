"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { premiumCardHoverClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";
import {
  SIGNED_PROTOCOL_KEYS,
  signedProtocolFill,
  type SignedProtocolChartKey,
} from "@/lib/executive/chart-theme";
import type { SignedProtocolSlice } from "@/lib/executive/portfolio-analytics";

type SignedProtocolChartProps = {
  slices: SignedProtocolSlice[];
  title?: string;
  description?: string;
  className?: string;
};

export function SignedProtocolChart({
  slices,
  title,
  description,
  className,
}: SignedProtocolChartProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const tExecutive = useTranslations("executive");
  const tCharts = useTranslations("executive.charts");

  const chartData = useMemo(
    () =>
      SIGNED_PROTOCOL_KEYS.map((key) => {
        const slice = slices.find((row) => row.key === key);
        return {
          key,
          label: tCharts(`signedProtocol.${key}`),
          value: slice?.count ?? 0,
          fill: signedProtocolFill(key),
        };
      }).filter((row) => row.value > 0),
    [slices, tCharts]
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

  const total = chartData.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <Card className={cn(premiumCardHoverClass, className)}>
      <CardHeader>
        <CardTitle>{title ?? tExecutive("signedProtocolChart")}</CardTitle>
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
                data={chartData}
                dataKey="value"
                nameKey="key"
                innerRadius={68}
                outerRadius={96}
                paddingAngle={2}
                strokeWidth={2}
                stroke="var(--color-background)"
              >
                {chartData.map((slice) => (
                  <Cell
                    key={slice.key as SignedProtocolChartKey}
                    fill={slice.fill}
                  />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                      return null;
                    }
                    const missing =
                      slices.find((row) => row.key === "missing")?.count ?? 0;
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
                          {missing.toLocaleString(locale)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 16}
                          className="fill-muted-foreground text-xs"
                        >
                          {tCharts("signedProtocol.missingCenter")}
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
