import { auth } from "@/lib/auth";
import {
  canDownloadSignedProtocol,
  resolveSignedProtocolAccess,
} from "@/lib/auth/signed-protocol-access";
import { serveStoredObjectResponse } from "@/lib/storage/serve-stored-object";
import { prisma } from "@/lib/prisma";
import {
  contentTypeForNationalId,
  getNationalIdRelativePath,
} from "@/lib/uploads/national-id-storage";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { unitId } = await params;
  const clientId =
    new URL(request.url).searchParams.get("clientId")?.trim() || undefined;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { client: true },
  });

  if (!unit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const targetId = clientId || unit.clientId;
  const client =
    unit.client?.id === targetId
      ? unit.client
      : targetId
        ? await prisma.client.findUnique({ where: { id: targetId } })
        : null;

  if (!client?.nationalIdFile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { csScope } = await resolveSignedProtocolAccess(
    session.user,
    unit.agentId
  );
  if (!canDownloadSignedProtocol(session.user, unit.agentId, csScope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storedName = client.nationalIdFile;
  const ext = storedName.includes(".") ? storedName.split(".").pop() : "jpg";
  const filename = `national-id-${client.name}.${ext}`;

  return serveStoredObjectResponse(
    getNationalIdRelativePath(storedName),
    filename,
    contentTypeForNationalId(storedName)
  );
}
