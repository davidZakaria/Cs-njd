import { GeneralSettingsPanel } from "@/components/system/general-settings-panel";
import { getSystemSettings } from "@/lib/actions/settings";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { resolveGeneralSettings } from "@/lib/system/settings-helpers";

export default async function GeneralSettingsPage() {
  await requireSuperAdmin();
  const stored = await getSystemSettings();
  const settings = resolveGeneralSettings(stored);

  return <GeneralSettingsPanel initialSettings={settings} />;
}
