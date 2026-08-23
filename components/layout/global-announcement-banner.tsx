"use client";

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "njd-announcement-dismissed";

export function GlobalAnnouncementBanner({ text }: { text: string }) {
  const t = useTranslations("announcement");
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    setVisible(sessionStorage.getItem(DISMISS_KEY) !== text);
  }, [text]);

  if (!text.trim() || visible !== true) {
    return null;
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, text);
    setVisible(false);
  }

  return (
    <Alert
      variant="info"
      className={cn(
        "mb-4 border-primary/25 bg-primary/5 shadow-sm",
        "[dir=rtl]:[&>svg]:col-start-1 [dir=rtl]:[&_[data-slot=alert-title]]:col-start-2",
        "[dir=rtl]:[&_[data-slot=alert-description]]:col-start-2"
      )}
    >
      <Megaphone className="size-4" />
      <div className="col-start-2 flex w-full items-start justify-between gap-3 [dir=rtl]:flex-row-reverse">
        <div className="min-w-0 flex-1 space-y-1 text-start">
          <AlertTitle>{t("title")}</AlertTitle>
          <AlertDescription>
            <p className="whitespace-pre-wrap text-foreground/90">{text}</p>
          </AlertDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleDismiss}
          aria-label={t("dismiss")}
        >
          <X className="size-4" />
        </Button>
      </div>
    </Alert>
  );
}
