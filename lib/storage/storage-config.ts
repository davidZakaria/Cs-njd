import { env } from "@/env";
import { readSystemSettingDirect } from "@/lib/system/settings-db-read";
import {
  SYSTEM_SETTING_KEYS,
  SYSTEM_SETTING_DEFAULTS,
} from "@/lib/system/settings-keys";
import {
  getS3ConfigFromEnv,
  isS3Configured,
  maskBucketName,
  type S3Config,
} from "@/lib/storage/s3-client";

export type ObjectStorageDriver = "local" | "s3";

export async function resolveObjectStorageDriver(): Promise<ObjectStorageDriver> {
  const fromDb = await readSystemSettingDirect(
    SYSTEM_SETTING_KEYS.OBJECT_STORAGE_DRIVER
  );
  if (fromDb === "s3" || fromDb === "local") {
    return fromDb;
  }
  return env.OBJECT_STORAGE_DRIVER;
}

export async function resolveRemoteBackupEnabled(): Promise<boolean> {
  const fromDb = await readSystemSettingDirect(
    SYSTEM_SETTING_KEYS.BACKUP_REMOTE_ENABLED
  );
  if (fromDb === "true") return isS3Configured();
  if (fromDb === "false") return false;
  return Boolean(env.BACKUP_REMOTE_ENABLED) && isS3Configured();
}

export async function resolveActiveStorageDriver(): Promise<ObjectStorageDriver> {
  const driver = await resolveObjectStorageDriver();
  if (driver === "s3" && !isS3Configured()) {
    return "local";
  }
  return driver;
}

export function getObjectStoragePublicConfig(): {
  s3Configured: boolean;
  bucketMasked: string | null;
  endpoint: string | null;
  uploadPrefix: string | null;
  backupPrefix: string | null;
} {
  const config = getS3ConfigFromEnv();
  if (!config) {
    return {
      s3Configured: false,
      bucketMasked: null,
      endpoint: null,
      uploadPrefix: null,
      backupPrefix: null,
    };
  }

  return {
    s3Configured: true,
    bucketMasked: maskBucketName(config.bucket),
    endpoint: config.endpoint,
    uploadPrefix: config.uploadPrefix,
    backupPrefix: config.backupPrefix,
  };
}

export function buildS3UploadKey(relativePath: string): string {
  const config = getS3ConfigFromEnv() as S3Config;
  const prefix = config.uploadPrefix.replace(/\/?$/, "/");
  return `${prefix}${relativePath.replace(/^\/+/, "")}`;
}

export function buildS3BackupKey(filename: string): string {
  const config = getS3ConfigFromEnv() as S3Config;
  const prefix = config.backupPrefix.replace(/\/?$/, "/");
  return `${prefix}${filename}`;
}

export function getStorageSettingDefaults() {
  return {
    objectStorageDriver:
      SYSTEM_SETTING_DEFAULTS.OBJECT_STORAGE_DRIVER as ObjectStorageDriver,
    backupRemoteEnabled:
      SYSTEM_SETTING_DEFAULTS.BACKUP_REMOTE_ENABLED === "true",
  };
}
