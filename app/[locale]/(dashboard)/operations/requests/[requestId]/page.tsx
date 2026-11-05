import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { canAccessOperationsArchiveFileInbox } from "@/lib/archive-file-request/permissions";
import { getArchiveFileRequestDetailForOperationsAction } from "@/lib/actions/archive-file-request";
import { OperationsArchiveFileRequestWorkspace } from "@/components/archive-file-request/operations-archive-file-request-workspace";
import { MarkOperationsArchiveFileRequestReadOnMount } from "@/components/archive-file-request/mark-operations-archive-file-request-read-on-mount";

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
  const request = await getArchiveFileRequestDetailForOperationsAction(requestId);
  if (!request || request.type !== "ARCHIVE_FILE_REQUEST") {
    notFound();
  }

  const isOpenForOps =
    request.status === "PENDING" && request.currentApproverKind === "OPERATIONS";

  return (
    <div className="mx-auto max-w-3xl">
      <MarkOperationsArchiveFileRequestReadOnMount requestId={requestId} />
      <OperationsArchiveFileRequestWorkspace
        request={{
          id: request.id,
          status: request.status,
          description: request.description,
          archiveFilePriority: request.archiveFilePriority,
          unit: request.unit,
          archiveFileItems: request.archiveFileItems,
        }}
        readOnly={!isOpenForOps}
      />
    </div>
  );
}
