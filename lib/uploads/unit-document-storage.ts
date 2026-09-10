import fs from "fs/promises";
import path from "path";

import { getUploadsRoot } from "@/lib/uploads/signed-protocol-storage";

import { MAX_UPLOAD_BYTES } from "@/lib/uploads/limits";

export const UNIT_DOCUMENT_MAX_BYTES = MAX_UPLOAD_BYTES;

export const UNIT_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type UnitDocumentMimeType = (typeof UNIT_DOCUMENT_MIME_TYPES)[number];

import type { UnitDocumentKind } from "@/lib/uploads/unit-document-constants";

export type { UnitDocumentKind };

const DIRECTORY_BY_KIND: Record<UnitDocumentKind, string> = {
  signedContract: "signed-contracts",
  extensionAnnex: "extension-annexes",
  finishingContract: "finishing-contracts",
};

export function getUnitDocumentDirectory(kind: UnitDocumentKind): string {
  return path.join(getUploadsRoot(), DIRECTORY_BY_KIND[kind]);
}

export function getUnitDocumentFilePath(
  kind: UnitDocumentKind,
  storedName: string
): string {
  return path.join(getUnitDocumentDirectory(kind), storedName);
}

function safeExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if ([".pdf", ".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  return ".pdf";
}

export function buildUnitDocumentStoredFilename(
  unitId: string,
  originalName: string
): string {
  return `${unitId}_${Date.now()}${safeExtension(originalName)}`;
}

export async function ensureUnitDocumentDirectory(
  kind: UnitDocumentKind
): Promise<void> {
  await fs.mkdir(getUnitDocumentDirectory(kind), { recursive: true });
}

export function getUnitDocumentRelativePath(
  kind: UnitDocumentKind,
  storedName: string
): string {
  return path.posix.join(DIRECTORY_BY_KIND[kind], storedName);
}

export async function writeUnitDocumentFile(
  kind: UnitDocumentKind,
  storedName: string,
  file: File
): Promise<void> {
  const { writeStoredObject } = await import("@/lib/storage/object-store");
  await writeStoredObject(getUnitDocumentRelativePath(kind, storedName), file);
}

export async function deleteUnitDocumentFile(
  kind: UnitDocumentKind,
  storedName: string | null | undefined
): Promise<void> {
  if (!storedName) return;
  const { deleteStoredObject } = await import("@/lib/storage/object-store");
  await deleteStoredObject(getUnitDocumentRelativePath(kind, storedName));
}

export function isAllowedUnitDocumentMime(
  mime: string
): mime is UnitDocumentMimeType {
  return (UNIT_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime);
}

export function contentTypeForUnitDocument(storedName: string): string {
  const ext = path.extname(storedName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}
