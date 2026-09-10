import { NextResponse } from "next/server";

import { readStoredObjectStream } from "@/lib/storage/object-store";

export async function serveStoredObjectResponse(
  relativePath: string,
  downloadFilename: string,
  fallbackContentType: string
) {
  try {
    const { stream, contentType } = await readStoredObjectStream(relativePath);

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType ?? fallbackContentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(downloadFilename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on server" }, { status: 404 });
  }
}
