import { basePrisma } from "@/lib/prisma";
import {
  SYSTEM_SETTING_DEFAULTS,
  SYSTEM_SETTING_KEYS,
  type SystemSettingKey,
} from "@/lib/system/settings-keys";

/** Direct DB read for scripts/cron — do not use `unstable_cache` here. */
export async function readSystemSettingDirect(
  key: SystemSettingKey
): Promise<string> {
  const row = await basePrisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  return row?.value ?? SYSTEM_SETTING_DEFAULTS[key];
}

export async function getBackupRetentionDaysDirect(): Promise<number> {
  const raw = await readSystemSettingDirect(
    SYSTEM_SETTING_KEYS.BACKUP_RETENTION_DAYS
  );
  const days = Number.parseInt(raw, 10);
  if (!Number.isFinite(days) || days < 1) {
    return Number.parseInt(SYSTEM_SETTING_DEFAULTS.BACKUP_RETENTION_DAYS, 10);
  }
  return days;
}
