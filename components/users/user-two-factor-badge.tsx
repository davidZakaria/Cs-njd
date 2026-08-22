"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function UserTwoFactorBadge({ enabled }: { enabled: boolean }) {
  const t = useTranslations("users");

  if (enabled) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 border-emerald-200/80 bg-emerald-500/10 font-medium text-emerald-800 shadow-sm",
          "dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200"
        )}
      >
        <ShieldCheck className="size-3.5" />
        {t("twoFactorSecured")}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-amber-200/80 bg-amber-500/10 font-medium text-amber-800 shadow-sm",
        "dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200"
      )}
    >
      <ShieldAlert className="size-3.5" />
      {t("twoFactorDisabled")}
    </Badge>
  );
}
