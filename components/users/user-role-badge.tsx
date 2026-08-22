import type { Role } from "@prisma/client";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const roleStyles: Record<Role, string> = {
  SUPER_ADMIN:
    "border-amber-200/80 bg-gradient-to-r from-violet-500/15 to-amber-500/15 text-violet-800 dark:border-violet-500/30 dark:from-violet-500/20 dark:to-amber-500/20 dark:text-violet-200",
  MANAGEMENT:
    "border-blue-200/80 bg-blue-500/10 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200",
  CS_AGENT:
    "border-slate-200/80 bg-slate-500/10 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200",
};

export function UserRoleBadge({ role }: { role: Role }) {
  const t = useTranslations("users");

  const label =
    role === "SUPER_ADMIN"
      ? t("roles.superAdmin")
      : role === "MANAGEMENT"
        ? t("roles.management")
        : t("roles.csAgent");

  return (
    <Badge
      variant="outline"
      className={cn("font-medium shadow-sm", roleStyles[role])}
    >
      {label}
    </Badge>
  );
}
