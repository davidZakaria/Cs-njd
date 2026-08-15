"use client";

import { useTranslations } from "next-intl";
import { triggerBackupAction } from "@/lib/actions/system";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Button } from "@/components/ui/button";

export function TriggerBackupButton() {
  const t = useTranslations("backups");
  const { pending, runAction } = useCrudToast();

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => runAction(() => triggerBackupAction(), "created")}
    >
      {t("triggerManual")}
    </Button>
  );
}
