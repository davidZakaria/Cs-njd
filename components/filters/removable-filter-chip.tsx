"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RemovableFilterChip({
  label,
  onRemove,
  className,
}: {
  label: string;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={cn("h-8 gap-1 rounded-full px-3 text-xs font-normal", className)}
      onClick={onRemove}
    >
      <span>{label}</span>
      <X className="size-3.5 opacity-70" aria-hidden />
      <span className="sr-only">Remove filter</span>
    </Button>
  );
}
