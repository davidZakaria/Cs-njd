import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { BackupManifest } from "@/lib/backup/backup-manifest";
import { getBackupDirectory } from "@/lib/backup/run-database-backup";
import { basePrisma } from "@/lib/prisma";
import type { UsageTone } from "@/lib/system/health-format";

export type BackupWarningCode =
  | "backup_stale"
  | "backup_dir_large"
  | "remote_backup_failed"
  | "remote_not_configured"
  | "insufficient_disk_for_backup";

export type BackupMetrics = {
  directoryBytes: number;
  archiveCount: number;
  largestArchiveBytes: number;
  lastSuccessAt: string | null;
  hoursSinceLastSuccess: number | null;
  lastArchiveBytes: number | null;
  lastRemoteStatus: "SUCCESS" | "FAILED" | "SKIPPED" | "none";
  lastRemoteAt: string | null;
  warningCodes: BackupWarningCode[];
  warningTone: UsageTone;
};

async function scanBackupDirectory(): Promise<{
  directoryBytes: number;
  archiveCount: number;
  largestArchiveBytes: number;
}> {
  const backupDir = getBackupDirectory();
  let directoryBytes = 0;
  let archiveCount = 0;
  let largestArchiveBytes = 0;

  try {
    const entries = await readdir(backupDir);
    for (const name of entries) {
      if (!name.endsWith(".tar.gz")) continue;
      const filepath = path.join(backupDir, name);
      const fileStat = await stat(filepath);
      directoryBytes += fileStat.size;
      archiveCount += 1;
      largestArchiveBytes = Math.max(largestArchiveBytes, fileStat.size);
    }
  } catch {
    // empty or missing backup dir
  }

  return { directoryBytes, archiveCount, largestArchiveBytes };
}

function hoursSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  return ms / (1000 * 60 * 60);
}

export async function getBackupMetrics(
  diskFreeBytes: number
): Promise<BackupMetrics> {
  const [dirStats, lastSuccess, lastAny] = await Promise.all([
    scanBackupDirectory(),
    basePrisma.backupLog.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
    }),
    basePrisma.backupLog.findFirst({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const lastSuccessAt = lastSuccess?.createdAt.toISOString() ?? null;
  const hoursSinceLastSuccess = hoursSince(lastSuccessAt);
  const lastManifest = lastAny?.manifest as BackupManifest | null | undefined;
  const lastRemote = lastManifest?.remote;
  const lastArchiveBytes = lastSuccess?.size ?? null;

  const warningCodes: BackupWarningCode[] = [];

  if (hoursSinceLastSuccess != null && hoursSinceLastSuccess > 26) {
    warningCodes.push("backup_stale");
  }

  if (dirStats.directoryBytes > 5 * 1024 * 1024 * 1024) {
    warningCodes.push("backup_dir_large");
  }

  if (lastRemote?.enabled && lastRemote.status === "FAILED") {
    warningCodes.push("remote_backup_failed");
  }

  if (lastRemote?.enabled && lastRemote.status === "SKIPPED") {
    warningCodes.push("remote_not_configured");
  }

  const projectedNeed = (lastArchiveBytes ?? dirStats.largestArchiveBytes) * 1.2;
  if (projectedNeed > 0 && diskFreeBytes > 0 && projectedNeed > diskFreeBytes) {
    warningCodes.push("insufficient_disk_for_backup");
  }

  const warningTone: UsageTone =
    warningCodes.includes("insufficient_disk_for_backup") ||
    warningCodes.includes("backup_stale") ||
    warningCodes.includes("remote_backup_failed")
      ? "critical"
      : warningCodes.length > 0
        ? "warning"
        : "healthy";

  return {
    ...dirStats,
    lastSuccessAt,
    hoursSinceLastSuccess,
    lastArchiveBytes,
    lastRemoteStatus: lastRemote?.status ?? "none",
    lastRemoteAt: lastSuccessAt,
    warningCodes,
    warningTone,
  };
}
