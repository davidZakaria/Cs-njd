"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
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
import type { ProjectOpenCount } from "@/lib/cases/executive-dashboard";
import { buildCasesFilterUrl } from "@/lib/cases/cases-filter-url";
import { premiumCardHoverClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";
import { projectBarFill } from "@/lib/executive/chart-theme";

type ProjectDistributionChartProps = {
  data: ProjectOpenCount[];
  title?: string;
  description?: string;
  className?: string;
  statusScope?: "open" | "RESOLVED";
};

export function ProjectDistributionChart({
  data,
  title,
  description,
  className,
  statusScope = "open",
}: ProjectDistributionChartProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const router = useRouter();
  const tExecutive = useTranslations("executive");
  const tCharts = useTranslations("executive.charts");
  const { project: projectLabel } = useDomainLabels();

  const chartData = useMemo(
    () =>
      data.map((item, index) => ({
        slug: item.slug,
        label: projectLabel(item.project),
        count: item.count,
        fill: projectBarFill(index),
      })),
    [data, projectLabel]
  );

  const chartConfig = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        chartData.map((item) => [
          item.slug,
          { label: item.label, color: item.fill },
        ])
      ),
    [chartData]
  );

  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className={cn(premiumCardHoverClass, className)}>
      <CardHeader>
        <CardTitle>{title ?? tExecutive("openCasesByProject")}</CardTitle>
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
              <Bar
                dataKey="count"
                radius={[6, 6, 0, 0]}
                maxBarSize={56}
                className="cursor-pointer"
                onClick={(bar) => {
                  const slug = (bar as { payload?: { slug?: string } })?.payload
                    ?.slug;
                  if (!slug) return;
                  router.push(
                    buildCasesFilterUrl({
                      status: statusScope === "RESOLVED" ? "RESOLVED" : "open",
                      project: slug,
                    })
                  );
                }}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.slug} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
