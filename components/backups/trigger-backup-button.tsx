"use client";

import { useTranslations } from "next-intl";
import { triggerBackupAction } from "@/lib/actions/system";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Button } from "@/components/ui/button";

export function TriggerBackupButton() {
  const t = useTranslations("backups");
  const { pending, notify } = useCrudToast();

  async function handleTrigger() {
    notify(await triggerBackupAction(), "created");
  }

  return (
    <form action={handleTrigger}>
      <Button type="submit" disabled={pending}>
        {t("triggerManual")}
      </Button>
    </form>
  );
}
