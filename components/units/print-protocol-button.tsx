"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function PrintProtocolButton({
  unitId,
  locale,
}: {
  unitId: string;
  locale: string;
}) {
  const t = useTranslations("print.handover");

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => {
        window.open(
          `/${locale}/print/handover/${unitId}`,
          "_blank",
          "noopener,noreferrer"
        );
      }}
    >
      <Printer className="size-4" />
      {t("printButton")}
    </Button>
  );
}
