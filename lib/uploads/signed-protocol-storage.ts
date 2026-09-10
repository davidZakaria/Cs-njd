import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { env } from "@/env";

import { MAX_UPLOAD_BYTES } from "@/lib/uploads/limits";

export const SIGNED_PROTOCOL_MAX_BYTES = MAX_UPLOAD_BYTES;

export const SIGNED_PROTOCOL_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type SignedProtocolMimeType = (typeof SIGNED_PROTOCOL_MIME_TYPES)[number];

export function getUploadsRoot(): string {
  return path.resolve(env.UPLOADS_DIR);
}

export function getSignedProtocolDirectory(unitId: string): string {
  return path.join(getUploadsRoot(), "signed-protocols", unitId);
}

export function getSignedProtocolFilePath(
  unitId: string,
  storedName: string
): string {
  return path.join(getSignedProtocolDirectory(unitId), storedName);
}

export function sanitizeOriginalFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-()+\s\u0600-\u06FF]/g, "_");
  return base.slice(0, 180) || "signed-protocol";
}

export function buildStoredFilename(originalName: string): string {
  const safe = sanitizeOriginalFilename(originalName);
  return `${randomUUID()}-${safe}`;
}

export async function ensureSignedProtocolDirectory(unitId: string): Promise<void> {
  await fs.mkdir(getSignedProtocolDirectory(unitId), { recursive: true });
}

export function getSignedProtocolRelativePath(
  unitId: string,
  storedName: string
): string {
  return path.posix.join("signed-protocols", unitId, storedName);
}

export async function writeSignedProtocolFile(
  unitId: string,
  storedName: string,
  file: File
): Promise<void> {
  const { writeStoredObject } = await import("@/lib/storage/object-store");
  await writeStoredObject(getSignedProtocolRelativePath(unitId, storedName), file);
}

export async function deleteSignedProtocolFile(
  unitId: string,
  storedName: string | null | undefined
): Promise<void> {
  if (!storedName) return;
  const { deleteStoredObject } = await import("@/lib/storage/object-store");
  await deleteStoredObject(getSignedProtocolRelativePath(unitId, storedName));
}

export function isAllowedSignedProtocolMime(mime: string): mime is SignedProtocolMimeType {
  return (SIGNED_PROTOCOL_MIME_TYPES as readonly string[]).includes(mime);
}

export function contentTypeForSignedProtocol(mime: string | null | undefined): string {
  if (mime && isAllowedSignedProtocolMime(mime)) return mime;
  return "application/octet-stream";
}
