"use client";

import { useMemo, useState } from "react";
import type { EngineeringApprovalKind, FinishingPhase } from "@prisma/client";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { CheckCircle2, ClipboardCheck, HardHat, Wrench } from "lucide-react";

import {
  approveEngineeringSiteVisitAction,
  approveEngineeringSnagDefectAction,
  saveEngineeringDataEntryAction,
  signOffEngineeringReadinessAction,
} from "@/lib/actions/unit-engineering-approvals";
import type { EngineeringApprovalHistoryRow } from "@/lib/workflow/engineering-approval-log";
import { FinishingPhasePicker } from "@/components/units/finishing-phase-picker";
import {
  normalizeFinishingPhases,
  sortPhases,
} from "@/lib/finishing/phases";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export type UnitEngineeringApprovalsDefaults = {
  unitId: string;
  siteVisitDone: boolean;
  siteVisitDate1: string | null;
  siteVisitDate2: string | null;
  siteVisitDate3: string | null;
  phases: FinishingPhase[];
  packageType: string | null;
  customModifications: string | null;
  modificationsCompleted: boolean;
};

const kindIcon = {
  SITE_VISIT_COMPLETION: CheckCircle2,
  SNAG_DEFECT_CLOSURE: Wrench,
  READINESS_SIGN_OFF: ClipboardCheck,
  DATA_ENTRY: HardHat,
} as const;

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

export function UnitEngineeringApprovalsPanel({
  defaults,
  history,
  canUse,
}: {
  defaults: UnitEngineeringApprovalsDefaults;
  history: EngineeringApprovalHistoryRow[];
  canUse: boolean;
}) {
  const locale = useLocale();
  const dateLocale = locale === "ar" ? ar : enUS;
  const t = useTranslations("units.engineeringApprovals");
  const labels = useDomainLabels();
  const { pending, runAction } = useCrudToast();

  const [siteVisitDone, setSiteVisitDone] = useState(defaults.siteVisitDone);
  const [siteVisitDate1, setSiteVisitDate1] = useState(
    toDateInput(defaults.siteVisitDate1)
  );
  const [siteVisitDate2, setSiteVisitDate2] = useState(
    toDateInput(defaults.siteVisitDate2)
  );
  const [siteVisitDate3, setSiteVisitDate3] = useState(
    toDateInput(defaults.siteVisitDate3)
  );
  const [phases, setPhases] = useState<FinishingPhase[]>(
    normalizeFinishingPhases(defaults.phases)
  );
  const [addNote, setAddNote] = useState("");
  const [addModification, setAddModification] = useState("");
  const [snagNote, setSnagNote] = useState("");
  const [readinessNote, setReadinessNote] = useState("");

  const hasCustomMods = Boolean(defaults.customModifications?.trim());
  const selectedPhases = useMemo(
    () => sortPhases(normalizeFinishingPhases(phases)),
    [phases]
  );

  if (!canUse) return null;

  const kindLabel = (kind: EngineeringApprovalKind) =>
    t(`kinds.${kind}` as "kinds.SITE_VISIT_COMPLETION");

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HardHat className="size-5 text-primary" />
            {t("title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("siteVisit.title")}</h3>
            <div className="flex items-start gap-3">
              <input
                id="engSiteVisitDone"
                type="checkbox"
                className="mt-1 size-4 rounded border"
                checked={siteVisitDone}
                disabled={pending}
                onChange={(e) => setSiteVisitDone(e.target.checked)}
              />
              <Label htmlFor="engSiteVisitDone" className="font-normal">
                {t("siteVisit.done")}
              </Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["siteVisitDate1", siteVisitDate1, setSiteVisitDate1],
                  ["siteVisitDate2", siteVisitDate2, setSiteVisitDate2],
                  ["siteVisitDate3", siteVisitDate3, setSiteVisitDate3],
                ] as const
              ).map(([key, value, setter]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={key}>{t(`siteVisit.${key}`)}</Label>
                  <Input
                    id={key}
                    type="date"
                    value={value}
                    disabled={pending}
                    onChange={(e) => setter(e.target.value)}
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(
                  () =>
                    approveEngineeringSiteVisitAction({
                      unitId: defaults.unitId,
                      siteVisitDone,
                      siteVisitDate1: siteVisitDate1 || undefined,
                      siteVisitDate2: siteVisitDate2 || undefined,
                      siteVisitDate3: siteVisitDate3 || undefined,
                    }),
                  "saved"
                )
              }
            >
              {t("siteVisit.save")}
            </Button>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("snagDefect.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {hasCustomMods
                ? t("snagDefect.hint")
                : t("snagDefect.noMods")}
            </p>
            <Textarea
              rows={2}
              value={snagNote}
              disabled={pending || !hasCustomMods}
              placeholder={t("snagDefect.notePlaceholder")}
              onChange={(e) => setSnagNote(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={
                pending ||
                !hasCustomMods ||
                defaults.modificationsCompleted
              }
              onClick={() =>
                runAction(
                  () =>
                    approveEngineeringSnagDefectAction({
                      unitId: defaults.unitId,
                      note: snagNote,
                    }),
                  "saved"
                )
              }
            >
              {defaults.modificationsCompleted
                ? t("snagDefect.alreadyClosed")
                : t("snagDefect.approve")}
            </Button>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("readiness.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("readiness.hint")}</p>
            <Textarea
              rows={2}
              value={readinessNote}
              disabled={pending}
              placeholder={t("readiness.notePlaceholder")}
              onChange={(e) => setReadinessNote(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                runAction(
                  () =>
                    signOffEngineeringReadinessAction({
                      unitId: defaults.unitId,
                      note: readinessNote,
                    }),
                  "saved"
                )
              }
            >
              {t("readiness.signOff")}
            </Button>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("dataEntry.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("dataEntry.hint")}</p>
            <FinishingPhasePicker
              value={phases}
              onChange={setPhases}
              disabled={pending}
              packageType={
                defaults.packageType
                  ? (defaults.packageType as import("@prisma/client").FinishingPackage)
                  : null
              }
              label={t("dataEntry.phases")}
              hint={t("dataEntry.phasesHint")}
              disabledHint={t("dataEntry.phasesDisabled")}
              selectAllLabel={t("dataEntry.selectAllPhases")}
              labelForPhase={labels.finishingPhase}
            />
            <div className="flex flex-wrap gap-1.5">
              {selectedPhases.map((phase) => (
                <Badge key={phase} variant="outline">
                  {labels.finishingPhase(phase)}
                </Badge>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="engAddNote">{t("dataEntry.addNote")}</Label>
                <Textarea
                  id="engAddNote"
                  rows={3}
                  value={addNote}
                  disabled={pending}
                  onChange={(e) => setAddNote(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="engAddMod">{t("dataEntry.addModification")}</Label>
                <Textarea
                  id="engAddMod"
                  rows={3}
                  value={addModification}
                  disabled={pending}
                  onChange={(e) => setAddModification(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(
                  () =>
                    saveEngineeringDataEntryAction({
                      unitId: defaults.unitId,
                      phases,
                      addFinishingNote: addNote,
                      addCustomModification: addModification,
                    }),
                  "saved"
                )
              }
            >
              {t("dataEntry.save")}
            </Button>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("history.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
          ) : (
            <ul className="space-y-3">
              {history.map((row) => {
                const Icon = kindIcon[row.kind];
                return (
                  <li
                    key={row.id}
                    className="flex gap-3 rounded-lg border border-border/60 p-3 text-sm"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium">{kindLabel(row.kind)}</p>
                      {row.summary ? (
                        <p className="text-muted-foreground">{row.summary}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {t("history.line", {
                          name: row.approvedBy.name,
                          date: format(row.createdAt, "PPp", {
                            locale: dateLocale,
                          }),
                        })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
