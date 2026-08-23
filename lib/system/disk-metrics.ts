import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DiskMetrics = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
  source: "statfs" | "df" | "mock";
};

const MOCK_DISK: DiskMetrics = {
  totalBytes: 100 * 1024 ** 3,
  freeBytes: 55 * 1024 ** 3,
  usedBytes: 45 * 1024 ** 3,
  usedPercent: 45,
  source: "mock",
};

function buildDiskMetrics(
  totalBytes: number,
  freeBytes: number,
  source: DiskMetrics["source"]
): DiskMetrics {
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const usedPercent =
    totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  return { totalBytes, freeBytes, usedBytes, usedPercent, source };
}

function rootMountPath(): string {
  return os.platform() === "win32" ? `${process.cwd().split("\\")[0]}\\` : "/";
}

async function getDiskViaStatfs(
  mountPath: string
): Promise<DiskMetrics | null> {
  try {
    const stat = await fs.statfs(mountPath);
    const totalBytes = stat.blocks * stat.bsize;
    const freeBytes = stat.bfree * stat.bsize;
    if (totalBytes <= 0) return null;
    return buildDiskMetrics(totalBytes, freeBytes, "statfs");
  } catch {
    return null;
  }
}

async function getDiskViaDf(mountPath: string): Promise<DiskMetrics | null> {
  try {
    const { stdout } = await execFileAsync("df", ["-k", mountPath]);
    const line = stdout.trim().split("\n")[1];
    if (!line) return null;

    const parts = line.split(/\s+/);
    if (parts.length < 4) return null;

    const totalKb = Number.parseInt(parts[1], 10);
    const usedKb = Number.parseInt(parts[2], 10);
    const availKb = Number.parseInt(parts[3], 10);
    if ([totalKb, usedKb, availKb].some(Number.isNaN)) return null;

    const totalBytes = totalKb * 1024;
    const freeBytes = availKb * 1024;
    const usedBytes = usedKb * 1024;
    const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

    return { totalBytes, freeBytes, usedBytes, usedPercent, source: "df" };
  } catch {
    return null;
  }
}

export async function getDiskMetrics(): Promise<DiskMetrics> {
  const mountPath = rootMountPath();

  const statfsResult = await getDiskViaStatfs(mountPath);
  if (statfsResult) return statfsResult;

  const dfResult = await getDiskViaDf(mountPath);
  if (dfResult) return dfResult;

  return MOCK_DISK;
}
