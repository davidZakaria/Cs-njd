import { LiveMonitoringDashboard } from "@/components/system/live-monitoring-dashboard";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { collectMonitoringMetrics } from "@/lib/system/health-metrics";

export default async function SystemMonitoringPage() {
  await requireSuperAdmin();
  const initialData = await collectMonitoringMetrics();

  return <LiveMonitoringDashboard initialData={initialData} />;
}
