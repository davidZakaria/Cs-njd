import path from "path";

import type { BackupSource } from "@prisma/client";
import { getUploadsRoot } from "@/lib/uploads/signed-protocol-storage";

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

export type SystemBackupDirSpec = {
  /** Path shown in manifest.json (archive-relative). */
  manifestPath: string;
  labelKey: string;
  resolveAbsolutePath: () => string;
};

export const SYSTEM_BACKUP_DIR_SPECS: SystemBackupDirSpec[] = [
  {
    manifestPath: "data/legacy/",
    labelKey: "legacyData",
    resolveAbsolutePath: () => path.join(process.cwd(), "data/legacy"),
  },
  {
    manifestPath: "uploads/",
    labelKey: "uploadedDocuments",
    resolveAbsolutePath: () => getUploadsRoot(),
  },
];

/** @deprecated Use SYSTEM_BACKUP_DIR_SPECS */
export const SYSTEM_BACKUP_DIRS: Array<{ path: string; labelKey: string }> =
  SYSTEM_BACKUP_DIR_SPECS.map((spec) => ({
    path: spec.manifestPath.replace(/\/$/, ""),
    labelKey: spec.labelKey,
  }));
