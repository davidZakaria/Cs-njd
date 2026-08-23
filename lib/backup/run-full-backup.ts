import { execFile } from "child_process";
import { access, cp, mkdir, readdir, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { promisify } from "util";
import type { BackupSource } from "@prisma/client";
import {
  getBackupDirectory,
  runDatabaseBackup,
} from "@/lib/backup/run-database-backup";
import {
  SYSTEM_BACKUP_DIRS,
  SYSTEM_BACKUP_FILES,
  type BackupManifest,
} from "@/lib/backup/backup-manifest";
import { basePrisma } from "@/lib/prisma";
import { getBackupRetentionDaysSetting } from "@/lib/system/settings-store";

const execFileAsync = promisify(execFile);

type BackupDb = typeof basePrisma;

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(full);
    } else {
      total += (await stat(full)).size;
    }
  }
  return total;
}

async function collectDatabaseCounts(prisma: BackupDb) {
  const [users, units, tickets, clients, projects, auditLogs] =
    await Promise.all([
      prisma.user.count(),
      prisma.unit.count(),
      prisma.ticket.count(),
      prisma.client.count(),
      prisma.project.count(),
      prisma.auditLog.count(),
    ]);
  return { users, units, tickets, clients, projects, auditLogs };
}

async function createArchive(
  stagingDir: string,
  archivePath: string
): Promise<number> {
  await mkdir(path.dirname(archivePath), { recursive: true });
  await execFileAsync("tar", ["-czf", archivePath, "-C", stagingDir, "."], {
    env: process.env,
  });
  return (await stat(archivePath)).size;
}

async function pruneOldBackups(prisma: BackupDb, backupDir: string): Promise<void> {
  const retentionDays = await getBackupRetentionDaysSetting();
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const stale = await prisma.backupLog.findMany({
    where: { createdAt: { lt: cutoff }, status: "SUCCESS" },
  });

  for (const entry of stale) {
    const filepath = path.join(backupDir, entry.filename);
    try {
      await rm(filepath, { force: true });
    } catch {
      // keep going
    }
    await prisma.backupLog.delete({ where: { id: entry.id } });
  }

  try {
    const entries = await readdir(backupDir);
    for (const name of entries) {
      if (!name.endsWith(".tar.gz")) continue;
      const filepath = path.join(backupDir, name);
      const fileStat = await stat(filepath);
      if (fileStat.mtime < cutoff) {
        await rm(filepath, { force: true });
      }
    }
  } catch {
    // ignore directory read errors
  }
}

export async function runFullBackup(
  prisma: BackupDb,
  source: BackupSource
): Promise<{ logId: string; manifest: BackupManifest }> {
  const backupDir = getBackupDirectory();
  await mkdir(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveFilename = `njd-full-backup-${stamp}.tar.gz`;
  const archivePath = path.join(backupDir, archiveFilename);
  const stagingDir = path.join(backupDir, `.staging-${stamp}`);
  const dbPath = path.join(stagingDir, "database.sql");

  const log = await prisma.backupLog.create({
    data: {
      filename: archiveFilename,
      status: "IN_PROGRESS",
      source,
    },
  });

  try {
    await mkdir(stagingDir, { recursive: true });
    await runDatabaseBackup(dbPath);
    const dbStat = await stat(dbPath);
    const counts = await collectDatabaseCounts(prisma);

    const systemDir = path.join(stagingDir, "system");
    await mkdir(systemDir, { recursive: true });

    const systemFiles: BackupManifest["systemFiles"] = [];

    for (const item of SYSTEM_BACKUP_FILES) {
      const abs = path.join(process.cwd(), item.path);
      const included = await pathExists(abs);
      let sizeBytes = 0;
      if (included) {
        const dest = path.join(systemDir, item.path);
        await mkdir(path.dirname(dest), { recursive: true });
        await cp(abs, dest);
        sizeBytes = (await stat(abs)).size;
      }
      systemFiles.push({
        path: item.path,
        labelKey: item.labelKey,
        sizeBytes,
        included,
      });
    }

    for (const item of SYSTEM_BACKUP_DIRS) {
      const abs = path.join(process.cwd(), item.path);
      const included = await pathExists(abs);
      let sizeBytes = 0;
      if (included) {
        const dest = path.join(systemDir, item.path);
        await cp(abs, dest, { recursive: true });
        sizeBytes = await dirSize(abs);
      }
      systemFiles.push({
        path: `${item.path}/`,
        labelKey: item.labelKey,
        sizeBytes,
        included,
      });
    }

    const manifest: BackupManifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      source,
      database: {
        filename: "database.sql",
        sizeBytes: dbStat.size,
        counts,
      },
      systemFiles,
      archive: {
        filename: archiveFilename,
        sizeBytes: 0,
      },
    };

    await writeFile(
      path.join(stagingDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );

    const archiveSize = await createArchive(stagingDir, archivePath);
    manifest.archive.sizeBytes = archiveSize;

    await prisma.backupLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        size: archiveSize,
        manifest: manifest as object,
      },
    });

    await pruneOldBackups(prisma, backupDir);
    return { logId: log.id, manifest };
  } catch (error) {
    await prisma.backupLog.update({
      where: { id: log.id },
      data: { status: "FAILED" },
    });
    throw error;
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }
}

export function getBackupCronSchedule(): string {
  return process.env.BACKUP_CRON?.trim() || "0 2 * * *";
}
