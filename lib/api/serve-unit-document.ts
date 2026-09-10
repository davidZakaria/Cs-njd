import { NextResponse } from "next/server";

import {
  canDownloadSignedProtocol,
  resolveSignedProtocolAccess,
} from "@/lib/auth/signed-protocol-access";
import { serveStoredObjectResponse } from "@/lib/storage/serve-stored-object";
import {
  contentTypeForUnitDocument,
  getUnitDocumentRelativePath,
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

  const ext = storedName.includes(".") ? storedName.split(".").pop() : "pdf";
  const filename = `${downloadLabel}.${ext}`;

  return serveStoredObjectResponse(
    getUnitDocumentRelativePath(kind, storedName),
    filename,
    contentTypeForUnitDocument(storedName)
  );
}
