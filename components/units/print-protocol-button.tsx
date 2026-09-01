"use client";

import { ChevronDown, Printer } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HANDOVER_VARIANT_OPTIONS } from "@/lib/print/handover-templates/resolve";
import { cn } from "@/lib/utils";

export function PrintProtocolButton({
  unitId,
  locale,
  projectName,
}: {
  unitId: string;
  locale: string;
  projectName: string;
}) {
  const t = useTranslations("print.handover");
  const isJura = projectName === "JURA";

  const openPrint = (insurance: boolean, dualSignature: boolean) => {
    const params = new URLSearchParams();
    if (!insurance) params.set("insurance", "no");
    if (dualSignature) params.set("dual", "yes");
    const query = params.toString();
    window.open(
      `/${locale}/print/handover/${unitId}${query ? `?${query}` : ""}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const variants = isJura
    ? [
        { key: "standard", insurance: true, dualSignature: false, labelKey: "variantJuraStandard" as const },
        { key: "dual", insurance: true, dualSignature: true, labelKey: "variantJuraDual" as const },
      ]
    : HANDOVER_VARIANT_OPTIONS;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
      >
        <Printer className="size-4" />
        {t("printButton")}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {variants.map((variant) => (
          <DropdownMenuItem
            key={variant.key}
            onClick={() => openPrint(variant.insurance, variant.dualSignature)}
          >
            {t(variant.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
