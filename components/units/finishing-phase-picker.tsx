"use client";

import type { FinishingPackage, FinishingPhase } from "@prisma/client";
import { ENGINEERING_FINISHING_PHASES } from "@/lib/finishing/phases";
import {
  isFinishingChecklistEnabled,
  normalizeFinishingPhases,
  selectAllEngineeringPhases,
  sortPhases,
  toggleFinishingPhase,
} from "@/lib/finishing/phases";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FinishingPhasePicker({
  value,
  onChange,
  disabled,
  packageType,
  label,
  hint,
  disabledHint,
  selectAllLabel,
  labelForPhase,
}: {
  value: FinishingPhase[];
  onChange: (phases: FinishingPhase[]) => void;
  disabled?: boolean;
  packageType?: FinishingPackage | null;
  label: string;
  hint?: string;
  disabledHint?: string;
  selectAllLabel: string;
  labelForPhase: (phase: FinishingPhase) => string;
}) {
  const checklistEnabled = isFinishingChecklistEnabled(packageType);
  const isDisabled = disabled || !checklistEnabled;
  const selected = normalizeFinishingPhases(value);

  function handleToggle(phase: FinishingPhase) {
    if (isDisabled) return;
    onChange(toggleFinishingPhase(selected, phase));
  }

  function handleSelectAll() {
    if (isDisabled) return;
    onChange(selectAllEngineeringPhases());
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && checklistEnabled ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
        {!checklistEnabled && disabledHint ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {disabledHint}
          </p>
        ) : null}
      </div>

      {selected.some((phase) => phase !== "NOT_STARTED") ? (
        <div className="flex flex-wrap gap-1.5">
          {sortPhases(selected).map((phase) => (
            <Badge key={phase} variant="secondary">
              {labelForPhase(phase)}
            </Badge>
          ))}
        </div>
      ) : null}

      {checklistEnabled ? (
        <div className="space-y-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isDisabled}
            onClick={handleSelectAll}
          >
            {selectAllLabel}
          </Button>
          <div className="space-y-1 rounded-lg border bg-background/90 p-2">
            {ENGINEERING_FINISHING_PHASES.map((phase) => {
              const checked = selected.includes(phase);
              return (
                <label
                  key={phase}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/60",
                    isDisabled && "cursor-not-allowed opacity-60",
                    checked && "bg-primary/10 ring-1 ring-primary/20"
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border"
                    checked={checked}
                    disabled={isDisabled}
                    onChange={() => handleToggle(phase)}
                  />
                  <span>{labelForPhase(phase)}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
