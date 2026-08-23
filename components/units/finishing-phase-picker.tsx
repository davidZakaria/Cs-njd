"use client";

import type { FinishingPhase } from "@prisma/client";
import { FINISHING_PHASE_OPTIONS } from "@/lib/validations/finishing";
import {
  normalizeFinishingPhases,
  sortPhases,
  toggleFinishingPhase,
} from "@/lib/finishing/phases";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FinishingPhasePicker({
  value,
  onChange,
  disabled,
  label,
  hint,
  labelForPhase,
}: {
  value: FinishingPhase[];
  onChange: (phases: FinishingPhase[]) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
  labelForPhase: (phase: FinishingPhase) => string;
}) {
  const selected = normalizeFinishingPhases(value);

  function handleToggle(phase: FinishingPhase) {
    if (disabled) return;
    onChange(toggleFinishingPhase(selected, phase));
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sortPhases(selected).map((phase) => (
          <Badge key={phase} variant="secondary">
            {labelForPhase(phase)}
          </Badge>
        ))}
      </div>
      <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border bg-background/90 p-2 sm:grid-cols-2">
        {FINISHING_PHASE_OPTIONS.map((phase) => {
          const checked = selected.includes(phase);
          return (
            <label
              key={phase}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
                disabled && "cursor-not-allowed opacity-60",
                checked && "bg-primary/10 ring-1 ring-primary/20"
              )}
            >
              <input
                type="checkbox"
                className="size-4 rounded border"
                checked={checked}
                disabled={disabled}
                onChange={() => handleToggle(phase)}
              />
              <span>{labelForPhase(phase)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
