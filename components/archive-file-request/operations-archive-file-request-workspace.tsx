"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import type { ArchiveFileItemStatus, ArchiveFileKind } from "@prisma/client";

import {
  fulfillArchiveFileItemUploadAction,
  markArchiveFileItemNotFoundAction,
} from "@/lib/actions/archive-file-request";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function OperationsArchiveFileRequestWorkspace({
  request,
}: {
  request: {
    id: string;
    description: string | null;
    archiveFilePriority: "NORMAL" | "URGENT" | null;
    unit: {
      id: string;
      unitCode: string;
      project: { name: string };
    } | null;
    archiveFileItems: Array<{
      id: string;
      fileKind: ArchiveFileKind;
      status: ArchiveFileItemStatus;
      notFoundNote: string | null;
      resultAttachmentId: string | null;
    }>;
  };
}) {
  const t = useTranslations("operationsArchiveFileRequests");
  const tEnums = useTranslations("enums");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notFoundNotes, setNotFoundNotes] = useState<Record<string, string>>({});

  if (!request.unit) {
    return <p className="text-sm text-muted-foreground">{t("unitMissing")}</p>;
  }

  const unitId = request.unit.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("detailTitle")}</h1>
          <p className="text-muted-foreground">
            {request.unit.project.name} · {request.unit.unitCode}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {request.archiveFilePriority === "URGENT" ? (
            <Badge variant="destructive">{t("urgent")}</Badge>
          ) : null}
          <Button variant="outline" size="sm" render={<Link href={`/units/${unitId}`} />}>
            {t("openUnit")}
          </Button>
        </div>
      </div>

      {request.description ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("note")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{request.description}</p>
          </CardContent>
        </Card>
      ) : null}

      <ul className="space-y-4">
        {request.archiveFileItems.map((item) => (
          <li key={item.id} className="rounded-lg border border-border/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{tEnums(`archiveFileKind.${item.fileKind}`)}</p>
              <Badge variant={item.status === "PENDING" ? "outline" : "secondary"}>
                {tEnums(`archiveFileItemStatus.${item.status}`)}
              </Badge>
            </div>

            {item.status === "PENDING" ? (
              <div className="flex flex-col gap-3">
                <form
                  className="flex flex-wrap items-end gap-2"
                  action={async (fd) => {
                    fd.set("itemId", item.id);
                    startTransition(async () => {
                      const result = await fulfillArchiveFileItemUploadAction(fd);
                      if (result.success) {
                        toast.success(t("uploaded"));
                        router.refresh();
                      } else toast.error(result.error ?? t("failed"));
                    });
                  }}
                >
                  <Input type="file" name="file" accept=".pdf,image/*" required />
                  <Button type="submit" size="sm" disabled={pending}>
                    {t("uploadScan")}
                  </Button>
                </form>
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <Textarea
                    rows={2}
                    placeholder={t("notFoundNotePlaceholder")}
                    value={notFoundNotes[item.id] ?? ""}
                    onChange={(e) =>
                      setNotFoundNotes((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={pending || !(notFoundNotes[item.id] ?? "").trim()}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await markArchiveFileItemNotFoundAction({
                          itemId: item.id,
                          note: notFoundNotes[item.id] ?? "",
                        });
                        if (result.success) {
                          toast.success(t("markedNotFound"));
                          router.refresh();
                        } else toast.error(result.error ?? t("failed"));
                      })
                    }
                  >
                    {t("markNotFound")}
                  </Button>
                </div>
              </div>
            ) : item.status === "NOT_FOUND" ? (
              <p className="text-sm text-muted-foreground">{item.notFoundNote}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("fileOnRecord")}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
