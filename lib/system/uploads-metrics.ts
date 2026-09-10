import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { getUploadsRoot } from "@/lib/uploads/signed-protocol-storage";

export type UploadsMetrics = {
  rootPath: string;
  totalBytes: number;
  fileCount: number;
  exists: boolean;
};

async function dirSizeAndCount(dir: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await dirSizeAndCount(full);
      bytes += nested.bytes;
      files += nested.files;
    } else {
      bytes += (await stat(full)).size;
      files += 1;
    }
  }
  return { bytes, files };
}

export async function getUploadsMetrics(): Promise<UploadsMetrics> {
  const rootPath = getUploadsRoot();
  try {
    await access(rootPath);
    const { bytes, files } = await dirSizeAndCount(rootPath);
    return { rootPath, totalBytes: bytes, fileCount: files, exists: true };
  } catch {
    return { rootPath, totalBytes: 0, fileCount: 0, exists: false };
  }
}
