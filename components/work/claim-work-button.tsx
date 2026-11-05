"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  claimArchiveGapTaskAction,
  claimUnitCycleStageAction,
  claimUnitRequestAction,
} from "@/lib/actions/work-claim";

export function ClaimWorkButton(
  props:
    | { kind: "unitCycle"; unitId: string }
    | { kind: "request"; requestId: string }
    | { kind: "gapTask"; gapTaskId: string }
) {
  const t = useTranslations("work.claim");
  const [pending, startTransition] = useTransition();

  function onClaim() {
    startTransition(async () => {
      if (props.kind === "unitCycle") {
        await claimUnitCycleStageAction({ unitId: props.unitId });
      } else if (props.kind === "request") {
        await claimUnitRequestAction({ requestId: props.requestId });
      } else {
        await claimArchiveGapTaskAction({ gapTaskId: props.gapTaskId });
      }
    });
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onClaim}>
      {t("action")}
    </Button>
  );
}
