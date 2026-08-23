import { unstable_cache } from "next/cache";

import { basePrisma } from "@/lib/prisma";
import {
  SYSTEM_SETTING_DEFAULTS,
  SYSTEM_SETTING_KEYS,
  type SystemSettingKey,
} from "@/lib/system/settings-keys";

export const SYSTEM_SETTINGS_CACHE_TAG = "system-settings";

async function readSettingFromDb(key: string): Promise<string | null> {
  const row = await basePrisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  return row?.value ?? null;
}

const getCachedSettingValue = unstable_cache(
  async (key: string) => readSettingFromDb(key),
  ["system-setting-value"],
  { revalidate: 60, tags: [SYSTEM_SETTINGS_CACHE_TAG] }
);

export async function getSettingValue(key: SystemSettingKey): Promise<string> {
  const stored = await getCachedSettingValue(key);
  return stored ?? SYSTEM_SETTING_DEFAULTS[key];
}

export async function getAnnouncementConfig(): Promise<{
  enabled: boolean;
  text: string;
}> {
  const [enabledRaw, text] = await Promise.all([
    getSettingValue(SYSTEM_SETTING_KEYS.ANNOUNCEMENT_ENABLED),
    getSettingValue(SYSTEM_SETTING_KEYS.ANNOUNCEMENT_TEXT),
  ]);

  return {
    enabled: enabledRaw === "true",
    text: text.trim(),
  };
}

export async function getWhatsAppTemplateSetting(): Promise<string> {
  return getSettingValue(SYSTEM_SETTING_KEYS.WA_TEMPLATE);
}

export async function getBackupRetentionDaysSetting(): Promise<number> {
  const raw = await getSettingValue(SYSTEM_SETTING_KEYS.BACKUP_RETENTION_DAYS);
  const days = Number.parseInt(raw, 10);
  if (!Number.isFinite(days) || days < 1) {
    return Number.parseInt(SYSTEM_SETTING_DEFAULTS.BACKUP_RETENTION_DAYS, 10);
  }
  return days;
}

export async function getCompanyProfileSettings(): Promise<{
  name: string;
  address: string;
}> {
  const [name, address] = await Promise.all([
    getSettingValue(SYSTEM_SETTING_KEYS.COMPANY_NAME),
    getSettingValue(SYSTEM_SETTING_KEYS.COMPANY_ADDRESS),
  ]);
  return { name, address };
}
