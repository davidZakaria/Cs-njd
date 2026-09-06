"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { reopenUnitTicket } from "@/lib/actions/crm";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REOPEN_STATUSES = ["PENDING", "ENGINEERING", "LEGAL"] as const;

type ReopenCaseModalProps = {
  ticketId: string | null;
  statusItems: Record<string, string>;
  disabled?: boolean;
};

export function ReopenCaseModal({
  ticketId,
  statusItems,
  disabled = false,
}: ReopenCaseModalProps) {
  const t = useTranslations("reopenModal");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [targetStatus, setTargetStatus] =
    useState<(typeof REOPEN_STATUSES)[number]>("PENDING");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setReason("");
      setTargetStatus("PENDING");
      setError(null);
    }
  }

  function handleSubmit() {
    if (!ticketId || !reason.trim()) return;

    setError(null);
    startTransition(async () => {
      const result = await reopenUnitTicket({
        ticketId,
        reason: reason.trim(),
        targetStatus,
      });

      if (!result.success) {
        setError(result.error ?? t("reopenFailed"));
        return;
      }

      handleOpenChange(false);
      toast.success(t("success"));
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || !ticketId}
            className="h-8 border-amber-600/40 text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40"
          />
        }
      >
        <RotateCcw className="size-3.5" />
        {t("triggerBtn")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reopen-reason">{t("reasonLabel")}</Label>
            <Textarea
              id="reopen-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("reasonPlaceholder")}
              rows={3}
              disabled={pending}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("statusLabel")}</Label>
            <Select
              value={targetStatus}
              onValueChange={(next) => {
                if (
                  next === "PENDING" ||
                  next === "ENGINEERING" ||
                  next === "LEGAL"
                ) {
                  setTargetStatus(next);
                }
              }}
              items={statusItems}
              disabled={pending}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REOPEN_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusItems[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            disabled={pending || !reason.trim() || !ticketId}
            onClick={handleSubmit}
          >
            {t("confirmBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
