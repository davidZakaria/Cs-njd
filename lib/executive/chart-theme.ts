import type { CategoryBreakdown } from "@/lib/cases/executive-dashboard";

/** Corporate palette — maps to `--color-chart-*` tokens in globals.css */
export const EXECUTIVE_CHART_COLORS = {
  primary: "var(--color-chart-1)",
  warning: "var(--color-chart-2)",
  legal: "var(--color-chart-3)",
  engineering: "var(--color-chart-4)",
  customerService: "var(--color-chart-5)",
  general: "var(--color-chart-2)",
} as const;

export const CATEGORY_CHART_KEYS = [
  "legal",
  "engineering",
  "customerService",
  "feedbackHistory",
  "general",
] as const satisfies ReadonlyArray<keyof CategoryBreakdown>;

export type CategoryChartKey = (typeof CATEGORY_CHART_KEYS)[number];

const CATEGORY_FILL: Record<CategoryChartKey, string> = {
  legal: EXECUTIVE_CHART_COLORS.legal,
  engineering: EXECUTIVE_CHART_COLORS.engineering,
  customerService: EXECUTIVE_CHART_COLORS.customerService,
  feedbackHistory: EXECUTIVE_CHART_COLORS.primary,
  general: EXECUTIVE_CHART_COLORS.general,
};

export type CategoryChartSlice = {
  key: CategoryChartKey;
  label: string;
  value: number;
  fill: string;
};

export function categoryBreakdownToSlices(
  breakdown: CategoryBreakdown,
  labels: Record<CategoryChartKey, string>
): CategoryChartSlice[] {
  return CATEGORY_CHART_KEYS.map((key) => ({
    key,
    label: labels[key],
    value: breakdown[key],
    fill: CATEGORY_FILL[key],
  })).filter((slice) => slice.value > 0);
}

export function projectBarFill(index: number): string {
  const palette = [
    EXECUTIVE_CHART_COLORS.primary,
    EXECUTIVE_CHART_COLORS.engineering,
    EXECUTIVE_CHART_COLORS.customerService,
    EXECUTIVE_CHART_COLORS.warning,
    EXECUTIVE_CHART_COLORS.legal,
  ];
  return palette[index % palette.length]!;
}
