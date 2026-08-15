import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const backup = await prisma.backupLog.findUnique({ where: { id } });
  if (!backup || backup.status !== "SUCCESS") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filepath = path.join(process.cwd(), "backups", backup.filename);

  try {
    const content = await fs.readFile(filepath);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/sql",
        "Content-Disposition": `attachment; filename="${backup.filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
