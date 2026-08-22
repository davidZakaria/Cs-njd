import { SystemHealthPanel } from "@/components/system/system-health-panel";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getSystemHealthMetrics } from "@/lib/system/health-metrics";

export default async function SystemMonitoringPage() {
  await requireSuperAdmin();
  const metrics = getSystemHealthMetrics();

  return <SystemHealthPanel metrics={metrics} />;
}
