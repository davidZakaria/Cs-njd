import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isOperationsRole } from "@/lib/auth/unit-roles";
import { loadArchiveCheckDetail } from "@/lib/archive-check/queries";
import { operationsMayWorkArchiveCheckRequest } from "@/lib/archive-check/permissions";
import { OperationsArchiveCheckWorkspace } from "@/components/archive-check/operations-archive-check-workspace";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OperationsArchiveCheckPage({
  params,
}: {
  params: Promise<{ requestId: string; locale: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isOperationsRole(session.user.role)) {
    redirect("/login");
  }

  const { requestId } = await params;
  const request = await loadArchiveCheckDetail(requestId);
  if (!request) notFound();

  if (!request.unit) notFound();

  const canWork = operationsMayWorkArchiveCheckRequest(session.user.role, {
    type: request.type,
    status: request.status,
    currentApproverKind: request.currentApproverKind,
    archiveCheckSubmittedAt: request.archiveCheckSubmittedAt,
    parentRequestId: request.parentRequestId,
    bulkProjectId: request.bulkProjectId,
  });

  return (
    <div className={cn("max-w-4xl", entranceAnimationClass)}>
      <OperationsArchiveCheckWorkspace
        requestId={request.id}
        unitCode={request.unit.unitCode}
        projectName={request.unit.project.name}
        items={request.archiveCheckItems.map((item) => ({
          itemKey: item.itemKey,
          status: item.status,
        }))}
        attachments={request.attachments.map((file) => ({
          id: file.id,
          originalName: file.originalName,
          archiveCheckItemKey: file.archiveCheckItemKey,
        }))}
        canSubmit={canWork}
      />
    </div>
  );
}
