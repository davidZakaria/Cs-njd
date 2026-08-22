"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { setUserTwoFactorByAdmin } from "@/lib/actions/two-factor";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function UserTwoFactorToggle({
  userId,
  userName,
  enabled,
  hasTwoFactorSecret,
  currentUserId,
  isSuperAdmin,
}: {
  userId: string;
  userName: string;
  enabled: boolean;
  hasTwoFactorSecret: boolean;
  currentUserId: string;
  isSuperAdmin: boolean;
}) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { pending, notify } = useCrudToast();
  const [confirmDisable, setConfirmDisable] = useState(false);

  const isSelf = userId === currentUserId;
  const canManage = isSuperAdmin && !isSelf;

  if (!canManage) {
    return (
      <span className="text-sm text-muted-foreground">
        {enabled ? tCommon("enabled") : tCommon("disabled")}
      </span>
    );
  }

  async function applyToggle(nextEnabled: boolean) {
    const result = await setUserTwoFactorByAdmin(userId, nextEnabled);
    if (!result.success) {
      notify(result);
      return;
    }
    notify(result, "saved");
    setConfirmDisable(false);
    router.refresh();
  }

  function handleToggle(nextEnabled: boolean) {
    if (nextEnabled && !hasTwoFactorSecret) {
      notify({
        success: false,
        error: t("twoFactorSetupRequired"),
      });
      return;
    }
    if (!nextEnabled) {
      setConfirmDisable(true);
      return;
    }
    void applyToggle(true);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t("twoFactorToggle", { name: userName })}
          disabled={pending}
          onClick={() => handleToggle(!enabled)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            enabled ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "pointer-events-none block size-5 rounded-full bg-background shadow-sm transition-transform duration-300",
              enabled
                ? "translate-x-5 rtl:-translate-x-5"
                : "translate-x-0.5 rtl:-translate-x-0.5"
            )}
          />
        </button>
        <span className="text-xs text-muted-foreground">
          {enabled ? tCommon("enabled") : tCommon("disabled")}
        </span>
      </div>

      <Dialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("twoFactorDisableTitle")}</DialogTitle>
            <DialogDescription>
              {t("twoFactorDisableConfirm", { name: userName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDisable(false)}
              disabled={pending}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => applyToggle(false)}
            >
              {t("twoFactorDisableAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
