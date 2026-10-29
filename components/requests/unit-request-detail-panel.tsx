"use client";

import { useState, useTransition } from "react";
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
} from "@/lib/actions/unit-requests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { UnitRequestStatus, UnitRequestType } from "@prisma/client";

export function UnitRequestDetailPanel({
  request,
  canApprove,
  canReject,
  canSubmit,
  canCancel,
  canComment,
  canUpload,
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
    auditEvents: Array<{ id: string; action: string; createdAt: string }>;
  };
  canApprove: boolean;
  canReject: boolean;
  canSubmit: boolean;
  canCancel: boolean;
  canComment: boolean;
  canUpload: boolean;
}) {
  const t = useTranslations("requests.detail");
  const tEnums = useTranslations("enums");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await fn();
      if (result.success) toast.success(t("saved"));
      else toast.error(result.error ?? t("failed"));
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {tEnums(`unitRequestType.${request.type}`)}
          </h1>
          <p className="text-muted-foreground">
            {request.projectName} · {request.unitCode}
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

      {request.description ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("description")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{request.description}</p>
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

      <div className="flex flex-wrap gap-2">
        {canSubmit ? (
          <Button
            disabled={pending}
            onClick={() => run(() => submitUnitRequestAction({ requestId: request.id }))}
          >
            {t("submit")}
          </Button>
        ) : null}
        {canApprove ? (
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
            <ul className="space-y-2 text-sm">
              {request.attachments.map((file) => (
                <li key={file.id}>
                  <a
                    className="text-primary underline"
                    href={`/api/unit-requests/${request.id}/attachments/${file.id}`}
                  >
                    {file.originalName}
                  </a>
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
          <ul className="space-y-1 text-sm text-muted-foreground">
            {request.auditEvents.map((event) => (
              <li key={event.id}>
                {t(`auditActions.${event.action}`, { defaultValue: event.action })}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
