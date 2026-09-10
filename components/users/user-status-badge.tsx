"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function UserStatusBadge({ isActive }: { isActive: boolean }) {
  const t = useTranslations("users.status");

  if (isActive) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "font-medium text-emerald-800 shadow-sm",
          "border-emerald-200/80 bg-emerald-500/10",
          "dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200"
        )}
      >
        {t("active")}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium text-muted-foreground",
        "bg-muted/80 dark:bg-muted/40"
      )}
    >
      {t("disabled")}
    </Badge>
  );
}
