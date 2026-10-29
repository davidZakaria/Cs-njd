"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { OperationsItemStatus } from "@/lib/operations/operations-progress";
import { cn } from "@/lib/utils";

const variantByStatus: Record<
  OperationsItemStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  done: "default",
  missing: "destructive",
  needs_update: "secondary",
  not_applicable: "outline",
};

export function OperationsStatusBadge({
  status,
  className,
}: {
  status: OperationsItemStatus;
  className?: string;
}) {
  const t = useTranslations("operations.status");
  return (
    <Badge
      variant={variantByStatus[status]}
      className={cn("text-xs font-normal", className)}
    >
      {t(status)}
    </Badge>
  );
}
