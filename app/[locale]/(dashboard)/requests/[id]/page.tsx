import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolveCsAgentScope } from "@/lib/auth/cs-agent-scope";
import { canAccessRequestsDashboard } from "@/lib/auth/role-permissions";
import { getUnitRequestDetailAction } from "@/lib/actions/unit-requests";
import { loadArchiveCheckDetail } from "@/lib/archive-check/queries";
import { isBulkArchiveCheckParent } from "@/lib/archive-check/permissions";
import {
  canAddRequestComment,
  canCancelRequest,
  canEditDraftRequest,
  canUploadRequestAttachment,
  userCanApproveAtCurrentStep,
  userCanRejectAtCurrentStep,
} from "@/lib/requests/permissions.server";
import { UnitRequestDetailPanel } from "@/components/requests/unit-request-detail-panel";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canAccessRequestsDashboard(session.user.role)) {
    redirect("/login");
  }

  const { id } = await params;
  const request = await getUnitRequestDetailAction(id);
  if (!request) notFound();

  const csScope =
    session.user.role === "CS_AGENT"
      ? await resolveCsAgentScope(session.user)
      : null;

  const canApprove = userCanApproveAtCurrentStep({
    role: session.user.role,
    request,
  });

  const canReject = userCanRejectAtCurrentStep({
    role: session.user.role,
    request,
  });

  const canSubmit =
    request.status === "DRAFT" &&
    canEditDraftRequest({
      role: session.user.role,
      userId: session.user.id,
      requestedById: request.requestedById,
    });

  const canCancel = canCancelRequest({
    role: session.user.role,
    userId: session.user.id,
    requestedById: request.requestedById,
    status: request.status,
  });

  const canComment = canAddRequestComment({
    role: session.user.role,
    userId: session.user.id,
    request,
    unitAgentId: request.unit.agentId,
    csScope,
  });

  const canUpload = canUploadRequestAttachment({
    role: session.user.role,
    userId: session.user.id,
    requestedById: request.requestedById,
    status: request.status,
    type: request.type,
  });

  let archiveProgressUnits:
    | Array<{
        unitCode: string;
        projectName: string;
        items: Array<{ itemKey: string; status: import("@prisma/client").ArchiveCheckItemStatus }>;
        gapTasks: Array<{ itemKey: string; status: import("@prisma/client").ArchiveCheckGapTaskStatus }>;
      }>
    | undefined;
  let bulkProjectName: string | null = null;

  if (request.type === "ARCHIVE_CHECK") {
    const archiveDetail = await loadArchiveCheckDetail(request.id);
    if (archiveDetail) {
      bulkProjectName = archiveDetail.bulkProject?.name ?? null;
      if (
        isBulkArchiveCheckParent({
          type: archiveDetail.type,
          bulkProjectId: archiveDetail.bulkProjectId,
          parentRequestId: archiveDetail.parentRequestId,
        })
      ) {
        archiveProgressUnits = archiveDetail.childRequests.map((child) => ({
          unitCode: child.unit.unitCode,
          projectName: child.unit.project.name,
          items: child.archiveCheckItems.map((item) => ({
            itemKey: item.itemKey,
            status: item.status,
          })),
          gapTasks: child.archiveCheckGapTasks.map((task) => ({
            itemKey: task.itemKey,
            status: task.status,
          })),
        }));
      } else {
        archiveProgressUnits = [
          {
            unitCode: archiveDetail.unit.unitCode,
            projectName: archiveDetail.unit.project.name,
            items: archiveDetail.archiveCheckItems.map((item) => ({
              itemKey: item.itemKey,
              status: item.status,
            })),
            gapTasks: archiveDetail.archiveCheckGapTasks.map((task) => ({
              itemKey: task.itemKey,
              status: task.status,
            })),
          },
        ];
      }
    }
  }

  return (
    <div className={cn("max-w-3xl", entranceAnimationClass)}>
      <UnitRequestDetailPanel
        request={{
          id: request.id,
          type: request.type,
          status: request.status,
          description: request.description,
          dueDate: request.dueDate?.toISOString() ?? null,
          linkedSwapTargetUnitId: request.linkedSwapTargetUnitId,
          currentApproverKind: request.currentApproverKind,
          escalatedToManagement: request.escalatedToManagement,
          unitId: request.unitId,
          unitCode: request.unit.unitCode,
          projectName: request.unit.project.name,
          comments: request.comments.map((c) => ({
            id: c.id,
            body: c.body,
            authorName: c.author.name,
            createdAt: c.createdAt.toISOString(),
          })),
          attachments: request.attachments.map((a) => ({
            id: a.id,
            originalName: a.originalName,
            createdAt: a.createdAt.toISOString(),
          })),
          auditEvents: request.auditEvents.map((e) => ({
            id: e.id,
            action: e.action,
            createdAt: e.createdAt.toISOString(),
          })),
        }}
        canApprove={canApprove}
        canReject={canReject}
        canSubmit={canSubmit}
        canCancel={canCancel}
        canComment={canComment}
        canUpload={canUpload}
        archiveProgressUnits={archiveProgressUnits}
        bulkProjectName={bulkProjectName}
      />
    </div>
  );
}
