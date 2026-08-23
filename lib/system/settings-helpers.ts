import {
  SYSTEM_SETTING_DEFAULTS,
  SYSTEM_SETTING_KEYS,
  type SystemSettingKey,
} from "@/lib/system/settings-keys";

export type SystemSettingsMap = Record<string, string>;

const GENERAL_SETTING_KEYS = [
  SYSTEM_SETTING_KEYS.ANNOUNCEMENT_ENABLED,
  SYSTEM_SETTING_KEYS.ANNOUNCEMENT_TEXT,
  SYSTEM_SETTING_KEYS.WA_TEMPLATE,
  SYSTEM_SETTING_KEYS.COMPANY_NAME,
  SYSTEM_SETTING_KEYS.COMPANY_ADDRESS,
] as const satisfies readonly SystemSettingKey[];

export type GeneralSettingKey = (typeof GENERAL_SETTING_KEYS)[number];

export function resolveGeneralSettings(
  stored: SystemSettingsMap
): Record<GeneralSettingKey, string> {
  return GENERAL_SETTING_KEYS.reduce(
    (acc, key) => {
      acc[key] = stored[key] ?? SYSTEM_SETTING_DEFAULTS[key];
      return acc;
    },
    {} as Record<GeneralSettingKey, string>
  );
}

export function isAnnouncementEnabled(settings: SystemSettingsMap): boolean {
  return (
    (settings[SYSTEM_SETTING_KEYS.ANNOUNCEMENT_ENABLED] ??
      SYSTEM_SETTING_DEFAULTS.ANNOUNCEMENT_ENABLED) === "true"
  );
}

const SYSTEM_ADMIN_SETTING_KEYS = [
  SYSTEM_SETTING_KEYS.MAINTENANCE_MODE,
  SYSTEM_SETTING_KEYS.BACKUP_RETENTION_DAYS,
] as const satisfies readonly SystemSettingKey[];

export type SystemAdminSettingKey = (typeof SYSTEM_ADMIN_SETTING_KEYS)[number];

export function resolveSystemAdminSettings(
  stored: SystemSettingsMap
): Record<SystemAdminSettingKey, string> {
  return SYSTEM_ADMIN_SETTING_KEYS.reduce(
    (acc, key) => {
      acc[key] = stored[key] ?? SYSTEM_SETTING_DEFAULTS[key];
      return acc;
    },
    {} as Record<SystemAdminSettingKey, string>
  );
}
