"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown, Circle, Lock } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  blockUnitCycleStageAction,
  completeUnitCycleStageAction,
  unblockUnitCycleStageAction,
} from "@/lib/actions/unit-cycle";
import type { UnitCycleChecklistItemKey } from "@/lib/operations/operations-progress";
import {
  resolveStageOwnerRole,
  viewerOwnsStageByRole,
} from "@/lib/unit-cycle/owners";
import { isStageOverdue } from "@/lib/unit-cycle/stage-rules";
import type { Role, UnitCycleStageKey, UnitCycleStageStatus, UnitRequestType } from "@prisma/client";

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
  viewerRole,
  viewerUserId,
  unitAgentId,
  blockingBannerEntries = [],
}: {
  unitId: string;
  activeStageKey: string | null;
  stages: StagePayload[];
  canManageStage: boolean;
  viewerRole?: Role;
  viewerUserId?: string;
  unitAgentId?: string | null;
  blockingBannerEntries?: Array<{
    requestId: string;
    type: UnitRequestType;
    gapItemKeys: string[];
  }>;
}) {
  const t = useTranslations("unitCycle");
  const tEnums = useTranslations("enums");
  const tItems = useTranslations("operations.items");
  const tDepartments = useTranslations("unitCycle.ownerDepartments");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const [stagesOpen, setStagesOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const activeStage = stages.find((stage) => stage.stageKey === activeStageKey);
  const blockedByRequest = blockingBannerEntries.length > 0;
  const canCompleteActive =
    activeStage?.checklistComplete && !blockedByRequest && canManageStage;

  const viewerOwnsActive =
    viewerRole != null &&
    activeStageKey != null &&
    viewerOwnsStageByRole(viewerRole, activeStageKey as UnitCycleStageKey, {
      unitAgentId: unitAgentId ?? null,
      userId: viewerUserId,
    });

  const activeOverdue =
    activeStage != null &&
    isStageOverdue({
      status: activeStage.status as UnitCycleStageStatus,
      deadlineAt: activeStage.deadlineAt
        ? new Date(activeStage.deadlineAt)
        : null,
    });

  const remainingChecklist =
    activeStage?.checklist.filter((item) => !item.passed) ?? [];

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
    });
  }

  function renderBlockingBanner() {
    if (!blockedByRequest) return null;
    return (
      <div
        className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        role="status"
      >
        <p className="font-medium text-amber-950 dark:text-amber-100">
          {t("blockedByRequest.title")}
        </p>
        <ul className="space-y-2">
          {blockingBannerEntries.map((entry) => (
            <li key={entry.requestId}>
              <Link
                href={`/requests/${entry.requestId}`}
                className="font-medium text-[var(--color-chart-1)] underline-offset-4 hover:underline"
              >
                {tEnums(`unitRequestType.${entry.type}`)}
              </Link>
              {entry.gapItemKeys.length > 0 ? (
                <ul className="ms-4 mt-1 list-disc space-y-0.5 text-muted-foreground">
                  {entry.gapItemKeys.map((itemKey) => (
                    <li key={itemKey}>{tItems(itemKey)}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function primaryAction() {
    if (!canManageStage || !activeStage) return null;

    if (blockedByRequest && blockingBannerEntries[0]) {
      return (
        <Link
          href={`/requests/${blockingBannerEntries[0].requestId}`}
          className={cn(
            buttonVariants({ size: "default" }),
            pending && "pointer-events-none opacity-50"
          )}
        >
          {t("yourTask.actions.reviewBlocker")}
        </Link>
      );
    }

    if (activeStage.status === "BLOCKED") {
      return (
        <Button
          size="default"
          disabled={pending}
          onClick={() => run(() => unblockUnitCycleStageAction({ unitId }))}
        >
          {t("actions.unblock")}
        </Button>
      );
    }

    if (canCompleteActive) {
      return (
        <Button
          size="default"
          disabled={pending}
          onClick={() => run(() => completeUnitCycleStageAction({ unitId }))}
        >
          {t("actions.completeStage")}
        </Button>
      );
    }

    return (
      <Button size="default" variant="secondary" disabled>
        {t("yourTask.actions.completeChecklist")}
      </Button>
    );
  }

  const currentOwnerRole =
    activeStageKey != null
      ? resolveStageOwnerRole(activeStageKey as UnitCycleStageKey)
      : null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border-2 border-[var(--color-chart-1)]/30 bg-gradient-to-br from-[var(--color-chart-1)]/5 via-card to-card p-4 shadow-sm ring-1 ring-[var(--color-chart-1)]/10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">{t("yourTask.title")}</h2>
          {viewerOwnsActive && activeStage ? (
            <Badge variant={activeStage.status === "BLOCKED" ? "destructive" : "secondary"}>
              {t(`status.${activeStage.status}`)}
            </Badge>
          ) : null}
        </div>

        {!activeStage ? (
          <p className="text-sm text-muted-foreground">{t("complete")}</p>
        ) : viewerOwnsActive ? (
          <div className="space-y-3">
            <p className="text-sm">
              {t("yourTask.stageLabel", {
                stage: t(`stages.${activeStage.stageKey}`),
              })}
            </p>
            {activeStage.deadlineAt ? (
              <p
                className={cn(
                  "text-sm",
                  activeOverdue
                    ? "font-medium text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {activeOverdue
                  ? t("yourTask.overdue", {
                      date: new Date(activeStage.deadlineAt).toLocaleDateString(
                        locale
                      ),
                    })
                  : t("due", {
                      date: new Date(activeStage.deadlineAt).toLocaleDateString(
                        locale
                      ),
                    })}
              </p>
            ) : null}
            {renderBlockingBanner()}
            {remainingChecklist.length > 0 ? (
              <div>
                <p className="mb-1 text-sm font-medium">{t("yourTask.remaining")}</p>
                <ul className="space-y-1 text-sm">
                  {remainingChecklist.map((item) => (
                    <li key={item.key} className="flex items-center gap-2 text-muted-foreground">
                      <Circle className="h-3.5 w-3.5 shrink-0" />
                      {t(`checklistItems.${item.key}`)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {t("yourTask.checklistDone")}
              </p>
            )}
            {activeStage.blockedReason ? (
              <p className="text-sm text-destructive">
                {t("blockedReason", { reason: activeStage.blockedReason })}
              </p>
            ) : null}
            <div>{primaryAction()}</div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">{t("yourTask.notYourTask")}</p>
            {currentOwnerRole ? (
              <p>
                {t("yourTask.currentOwner", {
                  stage: t(`stages.${activeStage.stageKey}`),
                  department: tDepartments(currentOwnerRole),
                })}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <div className="rounded-xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-start"
          onClick={() => setStagesOpen((open) => !open)}
          aria-expanded={stagesOpen}
        >
          <div>
            <h3 className="font-heading text-base font-semibold">{t("title")}</h3>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
              stagesOpen && "rotate-180"
            )}
          />
        </button>

        <ol
          className={cn(
            "mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
            !stagesOpen && "hidden",
            isRtl && "sm:flex-row-reverse"
          )}
        >
          {stages.map((stage, index) => {
            const done = stage.status === "DONE";
            const active = stage.stageKey === activeStageKey;
            const upcoming = !done && !active;
            const Icon = done ? Check : active ? Circle : Lock;
            return (
              <li
                key={stage.stageKey}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 text-center",
                  active && "font-semibold text-[var(--color-chart-1)]",
                  upcoming && "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border",
                    done && "border-emerald-500 bg-emerald-500/10 text-emerald-700",
                    active && !done && "border-[var(--color-chart-1)] bg-[var(--color-chart-1)]/10",
                    upcoming && "border-border"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs sm:text-sm">{t(`stages.${stage.stageKey}`)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {done
                    ? t("yourTask.stepDone")
                    : active
                      ? t("yourTask.stepCurrent")
                      : t("yourTask.stepUpcoming")}
                </span>
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
      </div>
    </div>
  );
}
