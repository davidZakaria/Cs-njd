import fs from "fs/promises";
import { NextResponse } from "next/server";

import {
  canDownloadSignedProtocol,
  resolveSignedProtocolAccess,
} from "@/lib/auth/signed-protocol-access";
import {
  contentTypeForUnitDocument,
  getUnitDocumentFilePath,
  type UnitDocumentKind,
} from "@/lib/uploads/unit-document-storage";

type SessionUser = {
  id: string;
  role: import("@prisma/client").Role;
  email?: string | null;
};

export async function serveUnitDocument(
  session: { user: SessionUser } | null,
  unit: { id: string; agentId: string | null },
  storedName: string | null | undefined,
  kind: UnitDocumentKind,
  downloadLabel: string
) {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!storedName) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { csScope } = await resolveSignedProtocolAccess(
    session.user,
    unit.agentId
  );
  if (!canDownloadSignedProtocol(session.user, unit.agentId, csScope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filepath = getUnitDocumentFilePath(kind, storedName);

  try {
    const content = await fs.readFile(filepath);
    const ext = storedName.includes(".") ? storedName.split(".").pop() : "pdf";
    const filename = `${downloadLabel}.${ext}`;

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentTypeForUnitDocument(storedName),
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on server" }, { status: 404 });
  }
}
