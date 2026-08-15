import type { BackupSource } from "@prisma/client";

export type BackupSystemFileEntry = {
  path: string;
  labelKey: string;
  sizeBytes: number;
  included: boolean;
};

export type BackupDatabaseCounts = {
  users: number;
  units: number;
  tickets: number;
  clients: number;
  projects: number;
  auditLogs: number;
};

export type BackupManifest = {
  version: 1;
  createdAt: string;
  source: BackupSource;
  database: {
    filename: string;
    sizeBytes: number;
    counts: BackupDatabaseCounts;
  };
  systemFiles: BackupSystemFileEntry[];
  archive: {
    filename: string;
    sizeBytes: number;
  };
};

export function isBackupManifest(value: unknown): value is BackupManifest {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    (value as BackupManifest).version === 1
  );
}

export const SYSTEM_BACKUP_FILES: Array<{ path: string; labelKey: string }> = [
  { path: ".env", labelKey: "envConfig" },
  { path: "deploy/ecosystem.config.cjs", labelKey: "pm2Config" },
  { path: "deploy/docker-compose.prod.yml", labelKey: "dockerConfig" },
  { path: "deploy/nginx-cs-njd.conf.example", labelKey: "nginxConfig" },
  { path: "prisma/schema.prisma", labelKey: "dbSchema" },
  { path: "package.json", labelKey: "appVersion" },
];

export const SYSTEM_BACKUP_DIRS: Array<{ path: string; labelKey: string }> = [
  { path: "data/legacy", labelKey: "legacyData" },
];
