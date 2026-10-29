import path from "path";

import { getUploadsRoot } from "@/lib/uploads/signed-protocol-storage";

const GENERATED_DIR = "generated-official-documents";

export function getGeneratedDocumentRelativePath(
  unitId: string,
  storedName: string
): string {
  return path.posix.join(GENERATED_DIR, unitId, storedName);
}

export function getGeneratedDocumentAbsolutePath(
  unitId: string,
  storedName: string
): string {
  return path.join(getUploadsRoot(), GENERATED_DIR, unitId, storedName);
}

export function buildGeneratedDocumentStoredFilename(
  documentType: string,
  locale: string
): string {
  return `${documentType.toLowerCase()}_${locale}_${Date.now()}.pdf`;
}

export async function writeGeneratedDocumentFile(
  unitId: string,
  storedName: string,
  bytes: Uint8Array
): Promise<void> {
  const { writeStoredObjectBuffer } = await import(
    "@/lib/storage/object-store"
  );
  await writeStoredObjectBuffer(
    getGeneratedDocumentRelativePath(unitId, storedName),
    Buffer.from(bytes),
    "application/pdf"
  );
}

export async function readGeneratedDocumentFile(
  unitId: string,
  storedName: string
): Promise<Uint8Array> {
  const { readGeneratedDocumentBytes } = await import(
    "@/lib/official-documents/render-pdf"
  );
  return readGeneratedDocumentBytes(
    getGeneratedDocumentRelativePath(unitId, storedName)
  );
}
