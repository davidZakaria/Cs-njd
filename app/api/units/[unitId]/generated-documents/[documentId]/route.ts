import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { canViewOfficialDocuments } from "@/lib/official-documents/permissions";
import { getGeneratedDocumentRelativePath } from "@/lib/official-documents/storage";
import { prisma } from "@/lib/prisma";
import { serveStoredObjectResponse } from "@/lib/storage/serve-stored-object";

type RouteParams = {
  params: Promise<{ unitId: string; documentId: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewOfficialDocuments(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { unitId, documentId } = await params;

  const doc = await prisma.unitGeneratedDocument.findFirst({
    where: { id: documentId, unitId },
  });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = `${doc.displayName.replace(/[^\w\s-]/g, "").trim() || "document"}.pdf`;

  return serveStoredObjectResponse(
    getGeneratedDocumentRelativePath(unitId, doc.storedName),
    filename,
    "application/pdf"
  );
}
