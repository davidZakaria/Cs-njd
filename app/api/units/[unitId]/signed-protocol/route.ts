import { auth } from "@/lib/auth";
import {
  canDownloadSignedProtocol,
  resolveSignedProtocolAccess,
} from "@/lib/auth/signed-protocol-access";
import { serveStoredObjectResponse } from "@/lib/storage/serve-stored-object";
import { prisma } from "@/lib/prisma";
import {
  contentTypeForSignedProtocol,
  getSignedProtocolRelativePath,
} from "@/lib/uploads/signed-protocol-storage";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { unitId } = await params;
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { contractWorkflow: true },
  });

  if (!unit?.contractWorkflow?.signedProtocolStoredName) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { csScope } = await resolveSignedProtocolAccess(
    session.user,
    unit.agentId
  );
  if (!canDownloadSignedProtocol(session.user, unit.agentId, csScope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workflow = unit.contractWorkflow;
  const filename =
    workflow.signedProtocolOriginalName ?? "signed-handover-protocol";

  return serveStoredObjectResponse(
    getSignedProtocolRelativePath(unitId, workflow.signedProtocolStoredName!),
    filename,
    contentTypeForSignedProtocol(workflow.signedProtocolMimeType)
  );
}
