import { SystemSettingsPanel } from "@/components/system/system-settings-panel";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { syncMaintenanceCookie } from "@/lib/system/maintenance-mode";

export default async function SystemSettingsPage() {
  await requireSuperAdmin();
  const maintenanceEnabled = await syncMaintenanceCookie();

  return <SystemSettingsPanel maintenanceEnabled={maintenanceEnabled} />;
}
