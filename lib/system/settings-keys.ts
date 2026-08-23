import { MAINTENANCE_MODE_KEY } from "@/lib/system/maintenance-cookie";

/** Known `SystemSetting.key` values used across the app. */
export const SYSTEM_SETTING_KEYS = {
  ANNOUNCEMENT_ENABLED: "ANNOUNCEMENT_ENABLED",
  ANNOUNCEMENT_TEXT: "ANNOUNCEMENT_TEXT",
  WA_TEMPLATE: "WA_TEMPLATE",
  COMPANY_NAME: "COMPANY_NAME",
  COMPANY_ADDRESS: "COMPANY_ADDRESS",
  MAINTENANCE_MODE: MAINTENANCE_MODE_KEY,
  BACKUP_RETENTION_DAYS: "BACKUP_RETENTION_DAYS",
} as const;

export type SystemSettingKey =
  (typeof SYSTEM_SETTING_KEYS)[keyof typeof SYSTEM_SETTING_KEYS];

export const SYSTEM_SETTING_DEFAULTS: Record<SystemSettingKey, string> = {
  ANNOUNCEMENT_ENABLED: "false",
  ANNOUNCEMENT_TEXT: "",
  WA_TEMPLATE:
    "Hello {client_name}, regarding unit {unit_code} at {project_name}.",
  COMPANY_NAME: "NJD",
  COMPANY_ADDRESS: "",
  MAINTENANCE_MODE: "false",
  BACKUP_RETENTION_DAYS: "14",
};
