"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function LegalBlockBanner() {
  const t = useTranslations("workflow.edgeCases");

  return (
    <Alert
      variant="destructive"
      className="border-2 border-destructive bg-destructive/15 px-5 py-4 text-base shadow-md"
    >
      <AlertTriangle className="size-5!" />
      <AlertTitle className="text-lg font-bold">
        {t("isLegallyBlocked")}
      </AlertTitle>
      <AlertDescription className="text-sm leading-relaxed text-destructive/95">
        {t("lawsuitWarning")}
      </AlertDescription>
    </Alert>
  );
}
