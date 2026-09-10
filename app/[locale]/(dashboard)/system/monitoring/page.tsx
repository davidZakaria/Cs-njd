import { LiveMonitoringDashboard } from "@/components/system/live-monitoring-dashboard";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { collectMonitoringMetrics } from "@/lib/system/health-metrics";
import {
  resolveObjectStorageDriver,
  resolveRemoteBackupEnabled,
} from "@/lib/storage/storage-config";

export const dynamic = "force-dynamic";

export default async function SystemMonitoringPage() {
  await requireSuperAdmin();
  const [initialData, initialStorageDriver, initialRemoteBackupEnabled] =
    await Promise.all([
      collectMonitoringMetrics(),
      resolveObjectStorageDriver(),
      resolveRemoteBackupEnabled(),
    ]);

  return (
    <LiveMonitoringDashboard
      initialData={initialData}
      initialStorageDriver={initialStorageDriver}
      initialRemoteBackupEnabled={initialRemoteBackupEnabled}
    />
  );
}
