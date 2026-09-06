"use client";

import { useMemo, useState } from "react";
import type { FinishingPackage, FinishingPhase } from "@prisma/client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import { returnToCsAction } from "@/lib/actions/engineering";
import { normalizeFinishingPhases } from "@/lib/finishing/phases";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { FinishingPhasePicker } from "@/components/units/finishing-phase-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function EngineeringTaskForm({
  unitId,
  unitCode,
  projectLabel,
  packageType,
  phases,
  customModifications,
  modificationsCompleted,
  engineeringNotes,
}: {
  unitId: string;
  unitCode: string;
  projectLabel: string;
  packageType: FinishingPackage | null;
  phases: FinishingPhase[];
  customModifications: string | null;
  modificationsCompleted: boolean;
  engineeringNotes: string | null;
}) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const router = useRouter();
  const t = useTranslations("engineering");
  const tFinishing = useTranslations("finishing");
  const tFinishingPhases = useTranslations("finishingPhases");
  const labels = useDomainLabels();
  const { pending, notify } = useCrudToast();

  const [selectedPhases, setSelectedPhases] = useState<FinishingPhase[]>(
    normalizeFinishingPhases(
      phases.length ? phases : ["NOT_STARTED"]
    )
  );
  const [modsCompleted, setModsCompleted] = useState(modificationsCompleted);
  const [notes, setNotes] = useState(engineeringNotes ?? "");

  const hasCustomMods = useMemo(
    () => Boolean(String(customModifications ?? "").trim()),
    [customModifications]
  );

  async function handleReturn() {
    const result = await returnToCsAction({
      unitId,
      phases: selectedPhases,
      modificationsCompleted: hasCustomMods ? modsCompleted : true,
      engineeringNotes: notes,
    });

    if (result.success) {
      notify(result, "saved", t("returnSuccess"));
      router.push("/engineering");
      router.refresh();
    } else {
      notify(result);
    }
  }

  return (
    <div className="space-y-6 pb-28" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {unitCode}
        </h1>
        <p className="text-muted-foreground">{projectLabel}</p>
      </div>

      {hasCustomMods ? (
        <Card className="border-amber-300/60 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-900 dark:text-amber-100">
              {t("customModifications")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="whitespace-pre-wrap text-amber-950 dark:text-amber-50">
              {customModifications}
            </p>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-5 rounded border"
                checked={modsCompleted}
                disabled={pending}
                onChange={(event) => setModsCompleted(event.target.checked)}
              />
              <span>{t("modificationsCompleted")}</span>
            </label>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("updateFinishes")}</CardTitle>
        </CardHeader>
        <CardContent
          className={cn(
            "[&_input[type=checkbox]]:size-5",
            "[&_label]:py-3 [&_label]:text-base"
          )}
        >
          <FinishingPhasePicker
            value={selectedPhases}
            onChange={setSelectedPhases}
            disabled={pending}
            packageType={packageType}
            label={tFinishing("phaseBannerLabel")}
            hint={tFinishing("phaseMultiHint")}
            disabledHint={tFinishing("phaseChecklistDisabled")}
            selectAllLabel={tFinishingPhases("selectAll")}
            labelForPhase={labels.finishingPhase}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("engineeringNotes")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="engineeringNotes" className="sr-only">
            {t("engineeringNotes")}
          </Label>
          <Textarea
            id="engineeringNotes"
            rows={5}
            value={notes}
            disabled={pending}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-32 resize-y text-base"
            placeholder={tFinishing("finishingNotesPlaceholder")}
          />
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {selectedPhases.some((phase) => phase !== "NOT_STARTED") ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedPhases.map((phase) => (
                <Badge key={phase} variant="secondary">
                  {labels.finishingPhase(phase)}
                </Badge>
              ))}
            </div>
          ) : null}
          <Button
            type="button"
            size="lg"
            className="h-12 w-full text-base"
            disabled={pending}
            onClick={handleReturn}
          >
            {t("returnToCS")}
          </Button>
        </div>
      </div>
    </div>
  );
}
