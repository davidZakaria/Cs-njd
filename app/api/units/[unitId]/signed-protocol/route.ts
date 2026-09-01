import { auth } from "@/lib/auth";
import {
  canDownloadSignedProtocol,
  resolveSignedProtocolAccess,
} from "@/lib/auth/signed-protocol-access";
import { prisma } from "@/lib/prisma";
import {
  contentTypeForSignedProtocol,
  getSignedProtocolFilePath,
} from "@/lib/uploads/signed-protocol-storage";
import fs from "fs/promises";
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
  const filepath = getSignedProtocolFilePath(
    unitId,
    workflow.signedProtocolStoredName!
  );

  try {
    const content = await fs.readFile(filepath);
    const filename =
      workflow.signedProtocolOriginalName ?? "signed-handover-protocol";

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentTypeForSignedProtocol(workflow.signedProtocolMimeType),
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on server" }, { status: 404 });
  }
}
