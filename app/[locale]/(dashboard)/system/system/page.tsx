import { SystemAdminPanel } from "@/components/system/system-admin-panel";
import { getSystemSettings } from "@/lib/actions/settings";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { resolveSystemAdminSettings } from "@/lib/system/settings-helpers";

export default async function SystemAdminPage() {
  await requireSuperAdmin();
  const stored = await getSystemSettings();
  const settings = resolveSystemAdminSettings(stored);

  return <SystemAdminPanel initialSettings={settings} />;
}
