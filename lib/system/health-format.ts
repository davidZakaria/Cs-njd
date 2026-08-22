export type UsageTone = "healthy" | "warning" | "critical";

export function getUsageTone(percent: number): UsageTone {
  if (percent >= 85) return "critical";
  if (percent >= 70) return "warning";
  return "healthy";
}

export function getLoadTone(load: number, cpuCount: number): UsageTone {
  if (cpuCount <= 0) return "healthy";
  return getUsageTone((load / cpuCount) * 100);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatUptime(seconds: number, locale: string): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  if (locale === "ar") {
    const parts: string[] = [];
    if (days > 0) parts.push(`${days} ي`);
    if (hours > 0) parts.push(`${hours} س`);
    parts.push(`${minutes} د`);
    return parts.join(" · ");
  }

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export const USAGE_TONE_BAR_CLASS: Record<UsageTone, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

export const USAGE_TONE_TEXT_CLASS: Record<UsageTone, string> = {
  healthy: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
};

export const USAGE_TONE_RING_CLASS: Record<UsageTone, string> = {
  healthy: "ring-emerald-500/25",
  warning: "ring-amber-500/25",
  critical: "ring-red-500/25",
};
