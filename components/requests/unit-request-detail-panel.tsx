"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";

import {
  approveUnitRequestStepAction,
  cancelUnitRequestAction,
  rejectUnitRequestAction,
  submitUnitRequestAction,
  addUnitRequestCommentAction,
  uploadUnitRequestAttachmentAction,
  updateUnitRequestDescriptionAction,
  removeUnitRequestAttachmentAction,
  replaceUnitRequestAttachmentAction,
} from "@/lib/actions/unit-requests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { UnitRequestStatus, UnitRequestType } from "@prisma/client";
import { ArchiveCheckProgressPanel } from "@/components/archive-check/archive-check-progress-panel";
import type { ArchiveCheckItemStatus, ArchiveCheckGapTaskStatus } from "@prisma/client";

type AuditEventRow = {
  id: string;
  action: string;
  createdAt: string;
  userName: string | null;
  details: Record<string, unknown> | null;
};

function formatAuditTimestamp(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function auditDetailString(value: unknown): string {
  if (value == null || value === "") return "—";
  return String(value);
}

export function UnitRequestDetailPanel({
  request,
  canApprove,
  canReject,
  canSubmit,
  canCancel,
  canComment,
  canUpload,
  canManageContent,
  locale,
  archiveProgressUnits,
  bulkProjectName,
  isBulkArchiveCheckParentRequest,
}: {
  request: {
    id: string;
    type: UnitRequestType;
    status: UnitRequestStatus;
    description: string | null;
    dueDate: string | null;
    linkedSwapTargetUnitId: string | null;
    currentApproverKind: string | null;
    escalatedToManagement: boolean;
    unitId: string;
    unitCode: string;
    projectName: string;
    comments: Array<{ id: string; body: string; authorName: string; createdAt: string }>;
    attachments: Array<{ id: string; originalName: string; createdAt: string }>;
    auditEvents: AuditEventRow[];
  };
  canApprove: boolean;
  canReject: boolean;
  canSubmit: boolean;
  canCancel: boolean;
  canComment: boolean;
  canUpload: boolean;
  canManageContent: boolean;
  locale: string;
  archiveProgressUnits?: Array<{
    unitCode: string;
    projectName: string;
    items: Array<{ itemKey: string; status: ArchiveCheckItemStatus }>;
    gapTasks: Array<{
      itemKey: string;
      status: ArchiveCheckGapTaskStatus;
      ownerRole: import("@prisma/client").Role;
    }>;
  }>;
  bulkProjectName?: string | null;
  isBulkArchiveCheckParentRequest?: boolean;
}) {
  const t = useTranslations("requests.detail");
  const tEnums = useTranslations("enums");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(
    request.description ?? ""
  );

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await fn();
      if (result.success) toast.success(t("saved"));
      else toast.error(result.error ?? t("failed"));
    });
  };

  const auditLines = useMemo(() => {
    return request.auditEvents.map((event) => {
      const when = formatAuditTimestamp(event.createdAt, locale);
      const who = event.userName ?? t("auditUnknownUser");
      const details = event.details ?? {};
      let body = t(`auditActions.${event.action}`, {
        defaultValue: event.action,
        user: who,
        when,
        name: auditDetailString(details.originalName ?? details.previousName),
        previousName: auditDetailString(details.previousName),
        newName: auditDetailString(details.newName ?? details.newOriginalName),
      });

      if (event.action === "description_updated") {
        body = t("auditActions.description_updated", { user: who, when });
      }
      if (event.action === "attachment_removed") {
        body = t("auditActions.attachment_removed", {
          user: who,
          when,
          name: auditDetailString(details.originalName),
        });
      }
      if (event.action === "attachment_replaced") {
        body = t("auditActions.attachment_replaced", {
          user: who,
          when,
          previousName: auditDetailString(details.previousName),
          newName: auditDetailString(details.newName),
        });
      }

      return { id: event.id, header: body, event, details };
    });
  }, [locale, request.auditEvents, t]);

  const showDescriptionCard =
    request.description != null ||
    canManageContent ||
    request.type !== "ARCHIVE_CHECK";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {tEnums(`unitRequestType.${request.type}`)}
          </h1>
          <p className="text-muted-foreground">
            {isBulkArchiveCheckParentRequest
              ? bulkProjectName ?? request.projectName
              : `${request.projectName} · ${request.unitCode}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {tEnums(`unitRequestStatus.${request.status}`)}
          </Badge>
          {request.escalatedToManagement ? (
            <Badge variant="destructive">{t("escalated")}</Badge>
          ) : null}
          {request.currentApproverKind ? (
            <Badge>{tEnums(`unitRequestApproverKind.${request.currentApproverKind}`)}</Badge>
          ) : null}
        </div>
      </div>

      {showDescriptionCard ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{t("description")}</CardTitle>
            {canManageContent && !editingDescription ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setDescriptionDraft(request.description ?? "");
                  setEditingDescription(true);
                }}
              >
                {t("editDescription")}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {editingDescription ? (
              <>
                <Textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={5}
                  maxLength={4000}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const result = await updateUnitRequestDescriptionAction({
                          requestId: request.id,
                          description: descriptionDraft,
                        });
                        if (result.success) setEditingDescription(false);
                        return result;
                      })
                    }
                  >
                    {t("saveDescription")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      setDescriptionDraft(request.description ?? "");
                      setEditingDescription(false);
                    }}
                  >
                    {t("cancelEdit")}
                  </Button>
                </div>
              </>
            ) : request.description ? (
              <p className="whitespace-pre-wrap text-sm">{request.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noDescription")}</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {request.type === "UNIT_SWAP" && request.linkedSwapTargetUnitId ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            <p>{t("unitSwapHint")}</p>
            <Button className="mt-3" variant="secondary" render={<Link href={`/units/${request.unitId}?tab=client`} />}>
              {t("openUnitSwap")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {request.type === "ARCHIVE_CHECK" && archiveProgressUnits?.length ? (
        <ArchiveCheckProgressPanel
          bulkProjectName={bulkProjectName}
          units={archiveProgressUnits}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canSubmit ? (
          <Button
            disabled={pending}
            onClick={() => run(() => submitUnitRequestAction({ requestId: request.id }))}
          >
            {t("submit")}
          </Button>
        ) : null}
        {canApprove && request.type !== "ARCHIVE_CHECK" ? (
          <Button
            disabled={pending}
            onClick={() =>
              run(() =>
                approveUnitRequestStepAction({ requestId: request.id, note })
              )
            }
          >
            {t("approve")}
          </Button>
        ) : null}
        {canReject ? (
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              run(() =>
                rejectUnitRequestAction({ requestId: request.id, note })
              )
            }
          >
            {t("reject")}
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => cancelUnitRequestAction({ requestId: request.id }))}
          >
            {t("cancel")}
          </Button>
        ) : null}
      </div>

      {(canApprove || canReject) && request.status === "PENDING" ? (
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("decisionNotePlaceholder")}
          rows={3}
        />
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("attachments")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {request.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAttachments")}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {request.attachments.map((file) => (
                <li key={file.id} className="flex flex-wrap items-center gap-2">
                  <a
                    className="text-primary underline"
                    href={`/api/unit-requests/${request.id}/attachments/${file.id}`}
                  >
                    {file.originalName}
                  </a>
                  {canManageContent ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            removeUnitRequestAttachmentAction({
                              requestId: request.id,
                              attachmentId: file.id,
                            })
                          )
                        }
                      >
                        {t("removeAttachment")}
                      </Button>
                      <form
                        className="inline-flex flex-wrap items-center gap-2"
                        action={async (fd) => {
                          fd.set("requestId", request.id);
                          fd.set("attachmentId", file.id);
                          startTransition(async () => {
                            const result =
                              await replaceUnitRequestAttachmentAction(fd);
                            if (result.success) toast.success(t("replaced"));
                            else toast.error(result.error ?? t("failed"));
                          });
                        }}
                      >
                        <Input
                          type="file"
                          name="file"
                          accept=".pdf,image/*"
                          required
                          className="max-w-xs"
                        />
                        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                          {t("replaceAttachment")}
                        </Button>
                      </form>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canUpload ? (
            <form
              className="flex flex-wrap items-center gap-2"
              action={async (fd) => {
                fd.set("requestId", request.id);
                startTransition(async () => {
                  const result = await uploadUnitRequestAttachmentAction(fd);
                  if (result.success) toast.success(t("uploaded"));
                  else toast.error(result.error ?? t("failed"));
                });
              }}
            >
              <Input type="file" name="file" accept=".pdf,image/*" required />
              <Button type="submit" size="sm" disabled={pending}>
                {t("upload")}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("comments")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {request.comments.map((c) => (
            <div key={c.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{c.authorName}</p>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
          {canComment ? (
            <div className="flex flex-col gap-2">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
              <Button
                size="sm"
                disabled={pending || !comment.trim()}
                onClick={() =>
                  run(async () => {
                    const result = await addUnitRequestCommentAction({
                      requestId: request.id,
                      body: comment,
                    });
                    if (result.success) setComment("");
                    return result;
                  })
                }
              >
                {t("addComment")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("audit")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {auditLines.map(({ id, header, event, details }) => (
              <li key={id} className="space-y-1">
                <p>{header}</p>
                {event.action === "description_updated" ? (
                  <blockquote className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-foreground">
                    <span className="font-medium">{t("previousDescription")}</span>
                    <p className="mt-1 whitespace-pre-wrap">
                      {auditDetailString(details.previousDescription)}
                    </p>
                  </blockquote>
                ) : null}
                {event.action === "attachment_removed" ||
                event.action === "attachment_replaced" ? (
                  <p className="text-xs">
                    <a
                      className="text-primary underline"
                      href={`/api/unit-requests/${request.id}/attachments/${auditDetailString(
                        event.action === "attachment_replaced"
                          ? details.previousAttachmentId
                          : details.attachmentId
                      )}`}
                    >
                      {t("viewArchivedAttachment", {
                        name: auditDetailString(
                          details.previousName ?? details.originalName
                        ),
                      })}
                    </a>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
