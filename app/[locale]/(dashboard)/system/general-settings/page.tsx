import { GeneralSettingsPanel } from "@/components/system/general-settings-panel";
import { LateRequestWatchersCard } from "@/components/system/late-request-watchers-card";
import { getSystemSettings } from "@/lib/actions/settings";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { prisma } from "@/lib/prisma";
import { resolveGeneralSettings } from "@/lib/system/settings-helpers";
import {
  SYSTEM_SETTING_DEFAULTS,
  SYSTEM_SETTING_KEYS,
} from "@/lib/system/settings-keys";

export default async function GeneralSettingsPage() {
  await requireSuperAdmin();
  const stored = await getSystemSettings();
  const settings = resolveGeneralSettings(stored);
  const watcherValue =
    stored[SYSTEM_SETTING_KEYS.LATE_REQUEST_WATCHERS] ??
    SYSTEM_SETTING_DEFAULTS[SYSTEM_SETTING_KEYS.LATE_REQUEST_WATCHERS];

  const candidates = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      NOT: { email: { endsWith: "@imported.njd.local" } },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return (
    <div className="space-y-8">
      <GeneralSettingsPanel initialSettings={settings} />
      <LateRequestWatchersCard
        initialValue={watcherValue}
        candidates={candidates}
      />
    </div>
  );
}