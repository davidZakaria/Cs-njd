import { NextResponse } from "next/server";

import { canAccessCsPortfolioDocuments } from "@/lib/auth/cs-portfolio-document-access";
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
  downloadLabel: string,
  access: "assignmentScoped" | "csPortfolio" = "assignmentScoped"
) {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!storedName) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (access === "csPortfolio") {
    if (!canAccessCsPortfolioDocuments(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const { csScope } = await resolveSignedProtocolAccess(
      session.user,
      unit.agentId
    );
    if (!canDownloadSignedProtocol(session.user, unit.agentId, csScope)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const ext = storedName.includes(".") ? storedName.split(".").pop() : "pdf";
  const filename = `${downloadLabel}.${ext}`;

  return serveStoredObjectResponse(
    getUnitDocumentRelativePath(kind, storedName),
    filename,
    contentTypeForUnitDocument(storedName)
  );
}
