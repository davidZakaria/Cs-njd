import fs from "fs/promises";
import path from "path";

import { getUploadsRoot } from "@/lib/uploads/signed-protocol-storage";

import { NATIONAL_ID_MAX_BYTES as NATIONAL_ID_LIMIT } from "@/lib/uploads/limits";

export const NATIONAL_ID_MAX_BYTES = NATIONAL_ID_LIMIT;

export const NATIONAL_ID_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type NationalIdMimeType = (typeof NATIONAL_ID_MIME_TYPES)[number];

export function getNationalIdDirectory(): string {
  return path.join(getUploadsRoot(), "national-ids");
}

export function getNationalIdFilePath(storedName: string): string {
  return path.join(getNationalIdDirectory(), storedName);
}

function safeExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if ([".pdf", ".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  return ".jpg";
}

export function buildNationalIdStoredFilename(
  clientId: string,
  originalName: string
): string {
  return `${clientId}_${Date.now()}${safeExtension(originalName)}`;
}

export async function ensureNationalIdDirectory(): Promise<void> {
  await fs.mkdir(getNationalIdDirectory(), { recursive: true });
}

export function getNationalIdRelativePath(storedName: string): string {
  return path.posix.join("national-ids", storedName);
}

export async function writeNationalIdFile(
  storedName: string,
  file: File
): Promise<void> {
  const { writeStoredObject } = await import("@/lib/storage/object-store");
  await writeStoredObject(getNationalIdRelativePath(storedName), file);
}

export async function deleteNationalIdFile(
  storedName: string | null | undefined
): Promise<void> {
  if (!storedName) return;
  const { deleteStoredObject } = await import("@/lib/storage/object-store");
  await deleteStoredObject(getNationalIdRelativePath(storedName));
}

export function isAllowedNationalIdMime(mime: string): mime is NationalIdMimeType {
  return (NATIONAL_ID_MIME_TYPES as readonly string[]).includes(mime);
}

export function contentTypeForNationalId(storedName: string): string {
  const ext = path.extname(storedName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}
