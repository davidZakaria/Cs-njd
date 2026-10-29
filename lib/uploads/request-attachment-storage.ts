import fs from "fs/promises";
import path from "path";

import { MAX_UPLOAD_BYTES } from "@/lib/uploads/limits";
import { getUploadsRoot } from "@/lib/uploads/signed-protocol-storage";

export const REQUEST_ATTACHMENT_MAX_BYTES = MAX_UPLOAD_BYTES;

export const REQUEST_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type RequestAttachmentMimeType =
  (typeof REQUEST_ATTACHMENT_MIME_TYPES)[number];

export function getRequestAttachmentsDirectory(): string {
  return path.join(getUploadsRoot(), "request-attachments");
}

export function getRequestAttachmentFilePath(storedName: string): string {
  return path.join(getRequestAttachmentsDirectory(), storedName);
}

function safeExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if ([".pdf", ".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  return ".pdf";
}

export function buildRequestAttachmentStoredFilename(
  requestId: string,
  originalName: string
): string {
  return `${requestId}_${Date.now()}${safeExtension(originalName)}`;
}

export async function ensureRequestAttachmentsDirectory(): Promise<void> {
  await fs.mkdir(getRequestAttachmentsDirectory(), { recursive: true });
}

export async function writeRequestAttachmentFile(
  storedName: string,
  bytes: Buffer
): Promise<void> {
  await ensureRequestAttachmentsDirectory();
  await fs.writeFile(getRequestAttachmentFilePath(storedName), bytes);
}

export function isAllowedRequestAttachmentMime(
  mime: string
): mime is RequestAttachmentMimeType {
  return (REQUEST_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mime);
}
