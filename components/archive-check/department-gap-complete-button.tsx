"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { completeArchiveCheckGapTaskAction } from "@/lib/actions/archive-check";
import { Button } from "@/components/ui/button";

export function DepartmentGapCompleteButton({ gapTaskId }: { gapTaskId: string }) {
  const t = useTranslations("archiveCheck.gapTasks");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await completeArchiveCheckGapTaskAction({ gapTaskId });
          if (!result.success) toast.error(result.error ?? t("failed"));
          else toast.success(t("completed"));
        })
      }
    >
      {t("markDone")}
    </Button>
  );
}
