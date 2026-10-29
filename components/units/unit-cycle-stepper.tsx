"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Circle, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  approveUnitCycleEngineeringAction,
  blockUnitCycleStageAction,
  completeUnitCycleStageAction,
  unblockUnitCycleStageAction,
} from "@/lib/actions/unit-cycle";
import type { UnitCycleChecklistItemKey } from "@/lib/operations/operations-progress";

type StagePayload = {
  stageKey: string;
  status: string;
  deadlineAt: string | null;
  blockedReason: string | null;
  checklist: { key: UnitCycleChecklistItemKey; passed: boolean }[];
  checklistComplete: boolean;
};

export function UnitCycleStepper({
  unitId,
  activeStageKey,
  stages,
  canManageStage,
  canApproveEngineering,
}: {
  unitId: string;
  activeStageKey: string | null;
  stages: StagePayload[];
  canManageStage: boolean;
  canApproveEngineering: boolean;
}) {
  const t = useTranslations("unitCycle");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const [pending, startTransition] = useTransition();

  const activeStage = stages.find((stage) => stage.stageKey === activeStageKey);

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
    });
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {activeStage ? (
          <Badge variant={activeStage.status === "BLOCKED" ? "destructive" : "secondary"}>
            {t(`status.${activeStage.status}`)}
          </Badge>
        ) : (
          <Badge variant="outline">{t("complete")}</Badge>
        )}
      </div>

      <ol
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
          isRtl && "sm:flex-row-reverse"
        )}
      >
        {stages.map((stage, index) => {
          const done = stage.status === "DONE";
          const active = stage.stageKey === activeStageKey;
          const Icon = done ? Check : active ? Circle : Lock;
          return (
            <li
              key={stage.stageKey}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 text-center",
                active && "font-semibold text-[var(--color-chart-1)]"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  done && "border-emerald-500 bg-emerald-500/10 text-emerald-700",
                  active && !done && "border-[var(--color-chart-1)] bg-[var(--color-chart-1)]/10",
                  !done && !active && "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs sm:text-sm">{t(`stages.${stage.stageKey}`)}</span>
              {stage.deadlineAt && active ? (
                <span className="text-[10px] text-muted-foreground">
                  {t("due", {
                    date: new Date(stage.deadlineAt).toLocaleDateString(locale),
                  })}
                </span>
              ) : null}
              {index < stages.length - 1 ? (
                <span className="hidden h-px flex-1 bg-border sm:block" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      {activeStage ? (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm font-medium">{t("checklist")}</p>
          <ul className="space-y-1 text-sm">
            {activeStage.checklist.map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                <Check
                  className={cn(
                    "h-4 w-4",
                    item.passed ? "text-emerald-600" : "text-muted-foreground/40"
                  )}
                />
                <span className={item.passed ? "" : "text-muted-foreground"}>
                  {t(`checklistItems.${item.key}`)}
                </span>
              </li>
            ))}
          </ul>
          {activeStage.blockedReason ? (
            <p className="text-sm text-destructive">
              {t("blockedReason", { reason: activeStage.blockedReason })}
            </p>
          ) : null}
          {canManageStage ? (
            <div className="flex flex-wrap gap-2">
              {activeStage.status === "BLOCKED" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => unblockUnitCycleStageAction({ unitId }))}
                >
                  {t("actions.unblock")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(() => blockUnitCycleStageAction({ unitId, blockedReason: "" }))
                  }
                >
                  {t("actions.block")}
                </Button>
              )}
              <Button
                size="sm"
                disabled={pending || !activeStage.checklistComplete}
                onClick={() => run(() => completeUnitCycleStageAction({ unitId }))}
              >
                {t("actions.completeStage")}
              </Button>
            </div>
          ) : null}
          {canApproveEngineering && activeStage.stageKey === "ENGINEERING" ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => approveUnitCycleEngineeringAction({ unitId }))}
            >
              {t("actions.approveEngineering")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
