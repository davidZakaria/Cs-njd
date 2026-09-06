"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, CircleX, PartyPopper } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import { toast } from "sonner";
import { resolveUnitTicket } from "@/lib/actions/crm";
import {
  allResolutionChecksPassed,
  buildChecklistFromSerialized,
  type SerializedResolutionContext,
} from "@/lib/workflow/resolution-checklist";
import { RESOLUTION_GATE_CODES } from "@/lib/workflow/resolution-gates";
import { confirmManagementOverride } from "@/components/workflow/management-override-field";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ResolveCaseModalProps = {
  ticketId: string | null;
  gateContext: SerializedResolutionContext;
  canUseManagementOverride: boolean;
  canBypassGates?: boolean;
  disabled?: boolean;
  onSuccess?: () => void;
  triggerClassName?: string;
};

export function ResolveCaseModal({
  ticketId,
  gateContext,
  canUseManagementOverride,
  canBypassGates = false,
  disabled = false,
  onSuccess,
  triggerClassName,
}: ResolveCaseModalProps) {
  const t = useTranslations("resolutionModal");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [finalNote, setFinalNote] = useState("");
  const [override, setOverride] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const checklist = useMemo(
    () => buildChecklistFromSerialized(gateContext),
    [gateContext]
  );

  const allPassed = allResolutionChecksPassed(checklist);
  const canSubmit =
    Boolean(ticketId) &&
    (allPassed || canBypassGates || (override && canUseManagementOverride));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setFinalNote("");
      setOverride(false);
      setError(null);
    }
  }

  function handleSubmit() {
    if (!ticketId) return;

    if (
      !confirmManagementOverride(
        "RESOLVED",
        override,
        t("overrideConfirm")
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await resolveUnitTicket({
        ticketId,
        finalNote: finalNote.trim() || undefined,
        managementOverride: override,
      });

      if (!result.success) {
        setError(result.error ?? t("resolveFailed"));
        return;
      }

      setOpen(false);
      setFinalNote("");
      setOverride(false);
      toast.success(t("success"));
      onSuccess?.();
      router.refresh();
    });
  }

  const triggerDisabled = disabled || !ticketId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="sm"
            disabled={triggerDisabled}
            className={cn(
              "h-8 border-emerald-600/40 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white",
              triggerClassName
            )}
          />
        }
      >
        {t("triggerBtn")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3">
          {RESOLUTION_GATE_CODES.map((code) => {
            const item = checklist.find((entry) => entry.code === code);
            const passed = item?.passed ?? false;
            return (
              <li
                key={code}
                className="flex items-start gap-2.5 text-sm"
              >
                {passed ? (
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-emerald-600"
                    aria-hidden
                  />
                ) : (
                  <CircleX
                    className="mt-0.5 size-4 shrink-0 text-destructive/80"
                    aria-hidden
                  />
                )}
                <span className={cn(!passed && "text-foreground")}>
                  {t(`checks.${code}`)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="space-y-1.5">
          <Label htmlFor="resolution-final-note">{t("noteLabel")}</Label>
          <Textarea
            id="resolution-final-note"
            value={finalNote}
            onChange={(event) => setFinalNote(event.target.value)}
            placeholder={t("notePlaceholder")}
            rows={3}
            disabled={pending}
            className="resize-y"
          />
        </div>

        {canUseManagementOverride ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <Label
              htmlFor="resolution-override"
              className="cursor-pointer text-sm font-normal leading-snug"
            >
              {t("managerOverride")}
            </Label>
            <Switch
              id="resolution-override"
              checked={override}
              onCheckedChange={setOverride}
              disabled={pending}
            />
          </div>
        ) : null}

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
            disabled={pending || !canSubmit}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={handleSubmit}
          >
            <PartyPopper className="size-4" />
            {t("confirmBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
