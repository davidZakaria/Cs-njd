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
  canManageOpenRequestContent,
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

  const { id, locale } = await params;
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
    unitAgentId: request.unit?.agentId ?? null,
    csScope,
  });

  const canUpload = canUploadRequestAttachment({
    role: session.user.role,
    userId: session.user.id,
    requestedById: request.requestedById,
    status: request.status,
    type: request.type,
  });

  const canManageContent = canManageOpenRequestContent({
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
        gapTasks: Array<{
          itemKey: string;
          status: import("@prisma/client").ArchiveCheckGapTaskStatus;
          ownerRole: import("@prisma/client").Role;
        }>;
      }>
    | undefined;
  let bulkProjectName: string | null = null;
  let isBulkParent = false;

  if (request.type === "ARCHIVE_CHECK") {
    const archiveDetail = await loadArchiveCheckDetail(request.id);
    if (archiveDetail) {
      bulkProjectName = archiveDetail.bulkProject?.name ?? null;
      isBulkParent = isBulkArchiveCheckParent({
        type: archiveDetail.type,
        bulkProjectId: archiveDetail.bulkProjectId,
        parentRequestId: archiveDetail.parentRequestId,
      });
      if (isBulkParent) {
        archiveProgressUnits = archiveDetail.childRequests
          .filter((child) => child.unit != null)
          .map((child) => ({
          unitCode: child.unit!.unitCode,
          projectName: child.unit!.project.name,
          items: child.archiveCheckItems.map((item) => ({
            itemKey: item.itemKey,
            status: item.status,
          })),
          gapTasks: child.archiveCheckGapTasks.map((task) => ({
            itemKey: task.itemKey,
            status: task.status,
            ownerRole: task.ownerRole,
          })),
        }));
      } else if (archiveDetail.unit) {
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
              ownerRole: task.ownerRole,
            })),
          },
        ];
      }
    }
  }

  const displayProjectName =
    isBulkParent && bulkProjectName
      ? bulkProjectName
      : (request.unit?.project.name ?? bulkProjectName ?? "—");
  const displayUnitCode = request.unit?.unitCode ?? "";

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
          unitId: request.unitId ?? "",
          unitCode: displayUnitCode,
          projectName: displayProjectName,
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
            userName: e.user?.name ?? null,
            details:
              e.details != null && typeof e.details === "object"
                ? (e.details as Record<string, unknown>)
                : null,
          })),
        }}
        canApprove={canApprove}
        canReject={canReject}
        canSubmit={canSubmit}
        canCancel={canCancel}
        canComment={canComment}
        canUpload={canUpload}
        canManageContent={canManageContent}
        locale={locale}
        archiveProgressUnits={archiveProgressUnits}
        bulkProjectName={bulkProjectName}
        isBulkArchiveCheckParentRequest={isBulkParent}
      />
    </div>
  );
}
