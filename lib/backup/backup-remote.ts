import type { BackupRemoteManifest } from "@/lib/backup/backup-manifest";
import {
  buildS3BackupKey,
  resolveRemoteBackupEnabled,
} from "@/lib/storage/storage-config";
import {
  getS3ConfigFromEnv,
  isS3Configured,
  uploadLocalFileToS3,
} from "@/lib/storage/s3-client";

export async function uploadBackupArchiveToRemote(
  archivePath: string,
  archiveFilename: string
): Promise<BackupRemoteManifest> {
  const enabled = await resolveRemoteBackupEnabled();

  if (!enabled) {
    return {
      enabled: false,
      status: "SKIPPED",
      provider: "local",
    };
  }

  if (!isS3Configured()) {
    return {
      enabled: true,
      status: "FAILED",
      provider: "s3",
      error: "S3/R2 credentials are not configured in environment variables",
    };
  }

  const config = getS3ConfigFromEnv()!;
  const objectKey = buildS3BackupKey(archiveFilename);
  const provider = config.endpoint.includes("r2.cloudflarestorage.com")
    ? "r2"
    : "s3";

  try {
    const sizeBytes = await uploadLocalFileToS3(
      archivePath,
      objectKey,
      "application/gzip"
    );

    return {
      enabled: true,
      status: "SUCCESS",
      provider,
      objectKey,
      sizeBytes,
    };
  } catch (error) {
    return {
      enabled: true,
      status: "FAILED",
      provider,
      objectKey,
      error: error instanceof Error ? error.message : "Remote upload failed",
    };
  }
}
