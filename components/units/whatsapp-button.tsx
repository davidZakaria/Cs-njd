"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { buildWhatsAppUrl, sanitizePhoneForWhatsApp } from "@/lib/format/whatsapp";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WhatsAppButton({
  phone,
  clientName,
  unitCode,
  projectName,
  className,
}: {
  phone: string | null | undefined;
  clientName: string;
  unitCode: string;
  projectName: string;
  className?: string;
}) {
  const t = useTranslations("units.whatsapp");
  const sanitized = sanitizePhoneForWhatsApp(phone);

  if (!sanitized) {
    return null;
  }

  const message = t("messageTemplate", {
    clientName,
    unitCode,
    projectName,
  });
  const href = buildWhatsAppUrl(sanitized, message);

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={cn(
        "h-7 gap-1 border-emerald-200/80 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20",
        "dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
        className
      )}
      onClick={() => {
        window.open(href, "_blank", "noopener,noreferrer");
      }}
      aria-label={t("buttonLabel", { phone: phone ?? "" })}
    >
      <MessageCircle className="size-3.5" />
      {t("buttonLabelShort")}
    </Button>
  );
}
