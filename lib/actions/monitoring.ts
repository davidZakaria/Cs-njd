"use server";

import { auth } from "@/lib/auth";
import { collectMonitoringMetrics } from "@/lib/system/health-metrics";
import type { MonitoringMetrics } from "@/lib/system/health-metrics";

export type MonitoringMetricsResult =
  | { success: true; data: MonitoringMetrics }
  | { success: false; error: string };

export async function fetchMonitoringMetrics(): Promise<MonitoringMetricsResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const data = await collectMonitoringMetrics();
    return { success: true, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load monitoring metrics";
    return { success: false, error: message };
  }
}
