import { createReadStream } from "node:fs";
import { access, unlink } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";

import { getUploadsRoot } from "@/lib/uploads/signed-protocol-storage";
import {
  buildS3UploadKey,
  resolveActiveStorageDriver,
} from "@/lib/storage/storage-config";
import {
  deleteS3Object,
  getS3ObjectStream,
  s3ObjectExists,
  uploadBufferToS3,
  uploadLocalFileToS3,
} from "@/lib/storage/s3-client";
import { writeUploadFileToPath } from "@/lib/storage/stream-to-disk";

function localAbsolutePath(relativePath: string): string {
  return path.join(getUploadsRoot(), relativePath);
}

export async function writeStoredObject(
  relativePath: string,
  file: File
): Promise<void> {
  const driver = await resolveActiveStorageDriver();

  if (driver === "s3") {
    const tempPath = path.join(
      getUploadsRoot(),
      ".tmp",
      `${Date.now()}-${path.basename(relativePath)}`
    );
    try {
      await writeUploadFileToPath(file, tempPath);
      await uploadLocalFileToS3(
        tempPath,
        buildS3UploadKey(relativePath),
        file.type || "application/octet-stream"
      );
    } finally {
      try {
        await unlink(tempPath);
      } catch {
        // temp cleanup is best-effort
      }
    }
    return;
  }

  await writeUploadFileToPath(file, localAbsolutePath(relativePath));
}

export async function writeStoredObjectBuffer(
  relativePath: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const driver = await resolveActiveStorageDriver();

  if (driver === "s3") {
    await uploadBufferToS3(
      buffer,
      buildS3UploadKey(relativePath),
      contentType
    );
    return;
  }

  const { writeFile, mkdir } = await import("node:fs/promises");
  const abs = localAbsolutePath(relativePath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
}

export async function readStoredObjectStream(
  relativePath: string
): Promise<{ stream: Readable; contentType?: string }> {
  const driver = await resolveActiveStorageDriver();

  if (driver === "s3") {
    return getS3ObjectStream(buildS3UploadKey(relativePath));
  }

  await access(localAbsolutePath(relativePath));
  return { stream: createReadStream(localAbsolutePath(relativePath)) };
}

export async function deleteStoredObject(
  relativePath: string | null | undefined
): Promise<void> {
  if (!relativePath) return;

  const driver = await resolveActiveStorageDriver();

  if (driver === "s3") {
    try {
      await deleteS3Object(buildS3UploadKey(relativePath));
    } catch {
      // missing remote object is acceptable
    }
    return;
  }

  try {
    await unlink(localAbsolutePath(relativePath));
  } catch {
    // missing local file is acceptable
  }
}

export async function storedObjectExists(relativePath: string): Promise<boolean> {
  const driver = await resolveActiveStorageDriver();

  if (driver === "s3") {
    return s3ObjectExists(buildS3UploadKey(relativePath));
  }

  try {
    await access(localAbsolutePath(relativePath));
    return true;
  } catch {
    return false;
  }
}
