"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";

import {
  submitArchiveCheckOperationsAction,
  updateArchiveCheckItemStatusAction,
  uploadArchiveCheckScanAction,
} from "@/lib/actions/archive-check";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ArchiveCheckItemStatus } from "@prisma/client";

type ItemRow = {
  itemKey: string;
  status: ArchiveCheckItemStatus;
};

type AttachmentRow = {
  id: string;
  originalName: string;
  archiveCheckItemKey: string | null;
};

const STATUS_OPTIONS: ArchiveCheckItemStatus[] = [
  "FOUND",
  "MISSING",
  "UNSIGNED",
];

export function OperationsArchiveCheckWorkspace({
  requestId,
  unitCode,
  projectName,
  items,
  attachments,
  canSubmit,
}: {
  requestId: string;
  unitCode: string;
  projectName: string;
  items: ItemRow[];
  attachments: AttachmentRow[];
  canSubmit: boolean;
}) {
  const t = useTranslations("archiveCheck.operations");
  const tItems = useTranslations("operations.items");
  const tStatus = useTranslations("archiveCheck.itemStatus");
  const [pending, startTransition] = useTransition();
  const [localItems, setLocalItems] = useState(items);

  const scansByKey = useMemo(() => {
    const map = new Map<string, AttachmentRow[]>();
    for (const file of attachments) {
      if (!file.archiveCheckItemKey) continue;
      const list = map.get(file.archiveCheckItemKey) ?? [];
      list.push(file);
      map.set(file.archiveCheckItemKey, list);
    }
    return map;
  }, [attachments]);

  const updateStatus = (itemKey: string, status: ArchiveCheckItemStatus) => {
    startTransition(async () => {
      const result = await updateArchiveCheckItemStatusAction({
        requestId,
        itemKey,
        status: status as "FOUND" | "MISSING" | "UNSIGNED",
      });
      if (!result.success) {
        toast.error(result.error ?? t("failed"));
        return;
      }
      setLocalItems((prev) =>
        prev.map((row) => (row.itemKey === itemKey ? { ...row, status } : row))
      );
    });
  };

  const uploadScan = (itemKey: string, file: File) => {
    const formData = new FormData();
    formData.set("requestId", requestId);
    formData.set("itemKey", itemKey);
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadArchiveCheckScanAction(formData);
      if (!result.success) toast.error(result.error ?? t("failed"));
      else toast.success(t("scanUploaded"));
    });
  };

  const submitCheck = () => {
    startTransition(async () => {
      const result = await submitArchiveCheckOperationsAction({ requestId });
      if (!result.success) toast.error(result.error ?? t("failed"));
      else toast.success(t("submitted"));
    });
  };

  const pendingCount = localItems.filter((item) => item.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{projectName}</p>
        <h1 className="text-2xl font-semibold">{unitCode}</h1>
        <p className="text-sm text-muted-foreground">{t("workspaceHint")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("checklistTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("itemColumn")}</TableHead>
                <TableHead>{t("statusColumn")}</TableHead>
                <TableHead>{t("scanColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localItems.map((item) => {
                const scans = scansByKey.get(item.itemKey) ?? [];
                return (
                  <TableRow key={item.itemKey}>
                    <TableCell>{tItems(item.itemKey)}</TableCell>
                    <TableCell>
                      <Select
                        value={item.status === "PENDING" ? "" : item.status}
                        onValueChange={(value) =>
                          updateStatus(item.itemKey, value as ArchiveCheckItemStatus)
                        }
                        disabled={pending || !canSubmit}
                      >
                        <SelectTrigger className="w-[10rem]">
                          <SelectValue placeholder={t("chooseStatus")} />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {tStatus(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="space-y-2">
                      {scans.map((scan) => (
                        <div key={scan.id} className="flex items-center gap-2 text-sm">
                          <span>{scan.originalName}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            render={
                              <a
                                href={`/api/unit-requests/${requestId}/attachments/${scan.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            }
                          >
                            {t("viewScan")}
                          </Button>
                        </div>
                      ))}
                      {canSubmit ? (
                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary">
                          <input
                            type="file"
                            className="sr-only"
                            disabled={pending}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) uploadScan(item.itemKey, file);
                              event.target.value = "";
                            }}
                          />
                          {t("uploadScan")}
                        </label>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canSubmit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={pending || pendingCount > 0} onClick={submitCheck}>
            {t("submitCheck")}
          </Button>
          {pendingCount > 0 ? (
            <Badge variant="outline">
              {t("pendingItems", { count: pendingCount })}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <Button variant="ghost" render={<Link href="/operations" />}>
        {t("backToQueue")}
      </Button>
    </div>
  );
}
