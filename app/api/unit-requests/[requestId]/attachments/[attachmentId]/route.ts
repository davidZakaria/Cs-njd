import fs from "fs/promises";

import { auth } from "@/lib/auth";
import { resolveCsAgentScope } from "@/lib/auth/cs-agent-scope";
import { canViewUnitRequest } from "@/lib/requests/permissions";
import { prisma } from "@/lib/prisma";
import { getRequestAttachmentFilePath } from "@/lib/uploads/request-attachment-storage";

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ requestId: string; attachmentId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { requestId, attachmentId } = await params;

  const attachment = await prisma.requestAttachment.findFirst({
    where: { id: attachmentId, requestId },
    include: {
      request: {
        include: { unit: { select: { agentId: true } } },
      },
    },
  });

  if (!attachment) {
    return new Response("Not found", { status: 404 });
  }

  const csScope =
    session.user.role === "CS_AGENT"
      ? await resolveCsAgentScope(session.user)
      : null;

  if (
    !canViewUnitRequest({
      role: session.user.role,
      userId: session.user.id,
      request: attachment.request,
      unitAgentId: attachment.request.unit.agentId,
      csScope,
    })
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const filePath = getRequestAttachmentFilePath(attachment.storedName);
    const data = await fs.readFile(filePath);
    return new Response(data, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
