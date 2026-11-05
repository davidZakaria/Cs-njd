import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { canAccessOperationsArchiveFileInbox } from "@/lib/archive-file-request/permissions";
import {
  getArchiveFileRequestDetailForOperationsAction,
  markOperationsArchiveFileRequestReadAction,
} from "@/lib/actions/archive-file-request";
import { OperationsArchiveFileRequestWorkspace } from "@/components/archive-file-request/operations-archive-file-request-workspace";

export default async function OperationsArchiveFileRequestDetailPage({
  params,
}: {
  params: Promise<{ locale: string; requestId: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canAccessOperationsArchiveFileInbox(session.user.role)) {
    redirect("/login");
  }

  const { requestId } = await params;
  await markOperationsArchiveFileRequestReadAction({ requestId });

  const request = await getArchiveFileRequestDetailForOperationsAction(requestId);
  if (!request || request.status !== "PENDING") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <OperationsArchiveFileRequestWorkspace
        request={{
          id: request.id,
          description: request.description,
          archiveFilePriority: request.archiveFilePriority,
          unit: request.unit,
          archiveFileItems: request.archiveFileItems,
        }}
      />
    </div>
  );
}
