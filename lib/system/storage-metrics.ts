import {
  getObjectStoragePublicConfig,
  resolveActiveStorageDriver,
  resolveObjectStorageDriver,
  resolveRemoteBackupEnabled,
} from "@/lib/storage/storage-config";

export type ObjectStorageMetrics = {
  driver: "local" | "s3";
  configuredDriver: "local" | "s3";
  s3Configured: boolean;
  remoteBackupEnabled: boolean;
  bucketMasked: string | null;
  endpoint: string | null;
  uploadPrefix: string | null;
  backupPrefix: string | null;
  driverFallback: boolean;
};

export async function getObjectStorageMetrics(): Promise<ObjectStorageMetrics> {
  const [
    configuredDriver,
    activeDriver,
    remoteBackupEnabled,
    publicConfig,
  ] = await Promise.all([
    resolveObjectStorageDriver(),
    resolveActiveStorageDriver(),
    resolveRemoteBackupEnabled(),
    Promise.resolve(getObjectStoragePublicConfig()),
  ]);

  return {
    driver: activeDriver,
    configuredDriver,
    s3Configured: publicConfig.s3Configured,
    remoteBackupEnabled,
    bucketMasked: publicConfig.bucketMasked,
    endpoint: publicConfig.endpoint,
    uploadPrefix: publicConfig.uploadPrefix,
    backupPrefix: publicConfig.backupPrefix,
    driverFallback: configuredDriver === "s3" && activeDriver === "local",
  };
}
