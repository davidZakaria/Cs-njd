import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

export async function writeWebStreamToFile(
  webStream: ReadableStream<Uint8Array>,
  destPath: string
): Promise<void> {
  await mkdir(path.dirname(destPath), { recursive: true });
  const nodeStream = Readable.fromWeb(
    webStream as import("stream/web").ReadableStream
  );
  await pipeline(nodeStream, createWriteStream(destPath));
}

/** Stream a browser File to disk without loading the full payload into RAM. */
export async function writeUploadFileToPath(
  file: File,
  destPath: string
): Promise<void> {
  await writeWebStreamToFile(file.stream(), destPath);
}
