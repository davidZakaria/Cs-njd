import { auth } from "@/lib/auth";
import {
  canDownloadSignedProtocol,
  resolveSignedProtocolAccess,
} from "@/lib/auth/signed-protocol-access";
import { prisma } from "@/lib/prisma";
import {
  contentTypeForNationalId,
  getNationalIdFilePath,
} from "@/lib/uploads/national-id-storage";
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
    include: { client: true },
  });

  if (!unit?.client?.nationalIdFile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { csScope } = await resolveSignedProtocolAccess(
    session.user,
    unit.agentId
  );
  if (!canDownloadSignedProtocol(session.user, unit.agentId, csScope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storedName = unit.client.nationalIdFile;
  const filepath = getNationalIdFilePath(storedName);

  try {
    const content = await fs.readFile(filepath);
    const ext = storedName.includes(".") ? storedName.split(".").pop() : "jpg";
    const filename = `national-id-${unit.client.name}.${ext}`;

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentTypeForNationalId(storedName),
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on server" }, { status: 404 });
  }
}
