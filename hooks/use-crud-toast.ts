"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/result";

export type CrudToastKind = "saved" | "created" | "deleted" | "assigned";

export function useCrudToast() {
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();

  const messages: Record<CrudToastKind, string> = {
    saved: t("savedSuccess"),
    created: t("createdSuccess"),
    deleted: t("deletedSuccess"),
    assigned: t("assignedSuccess"),
  };

  function notify(
    result: ActionResult,
    kind: CrudToastKind = "saved",
    successMessage?: string
  ) {
    if (result.success) {
      toast.success(successMessage ?? result.message ?? messages[kind]);
    } else {
      toast.error(result.error || t("actionFailed"));
    }
  }

  function runAction(
    action: () => Promise<ActionResult>,
    kind: CrudToastKind = "saved",
    successMessage?: string
  ) {
    startTransition(async () => {
      const result = await action();
      notify(result, kind, successMessage);
    });
  }

  return { pending, notify, runAction };
}
