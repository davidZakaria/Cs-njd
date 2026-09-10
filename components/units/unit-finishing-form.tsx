"use client";

import { useMemo, useState } from "react";
import type { FinishingPackage } from "@prisma/client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { CalendarIcon, HardHat } from "lucide-react";

import { updateCsFinishingAdditions, updateFinishing } from "@/lib/actions/crm";
import { formatCurrency } from "@/lib/format/currency";
import {
  EXECUTING_COMPANY_OPTIONS,
  FINISHING_PACKAGE_OPTIONS,
  finishingFormSchema,
  type FinishingFormInput,
} from "@/lib/validations/finishing";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FinishingPhasePicker } from "@/components/units/finishing-phase-picker";
import { UnitDocumentUpload } from "@/components/units/unit-document-upload";
import {
  normalizeFinishingPhases,
  sortPhases,
} from "@/lib/finishing/phases";
import { cn } from "@/lib/utils";

export type FinishingFormDefaults = {
  unitId: string;
  phases: string[];
  packageType: string | null;
  executingCompany: string | null;
  contractDate: string | null;
  datedAt: string | null;
  deliveryDate: string | null;
  emailDate: string | null;
  pricePerMeter: number | null;
  totalFinishingPrice: number | null;
  doorFees: number | null;
  aluminumFees: number | null;
  currentFinishingStatus: string | null;
  customModifications: string | null;
  modificationsCompleted: boolean;
  packageLabel: string | null;
  companyName: string | null;
  finishingType: string | null;
  finishingContractFile: string | null;
};

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function DatePickerField({
  id,
  label,
  value,
  onChange,
  disabled,
  locale,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  locale: string;
}) {
  const dateLocale = locale === "ar" ? ar : enUS;
  const selected = parseDateValue(value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                "w-full justify-start text-start font-normal",
                !selected && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="size-4 opacity-60" />
              {selected
                ? format(selected, "PPP", { locale: dateLocale })
                : "—"}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            locale={dateLocale}
            onSelect={(date) => {
              onChange(date ? format(date, "yyyy-MM-dd") : "");
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function UnitFinishingForm({
  defaults,
  canEditManagement = false,
  canEditCsFinishing = false,
  canEdit,
  canUploadDocuments = false,
  packageDisplayLabel,
  companyDisplayLabel,
}: {
  defaults: FinishingFormDefaults;
  canEditManagement?: boolean;
  canEditCsFinishing?: boolean;
  /** @deprecated Use canEditManagement */
  canEdit?: boolean;
  canUploadDocuments?: boolean;
  packageDisplayLabel: string;
  companyDisplayLabel: string;
}) {
  const managementEdit = canEditManagement || Boolean(canEdit);
  const canSubmitCs = canEditCsFinishing && !managementEdit;
  const locale = useLocale();
  const router = useRouter();
  const isRtl = locale === "ar";
  const t = useTranslations("units");
  const tFinishing = useTranslations("finishing");
  const tEdge = useTranslations("workflow.edgeCases");
  const tFields = useTranslations("fields");
  const tFinishingPhases = useTranslations("finishingPhases");
  const tCommon = useTranslations("common");
  const labels = useDomainLabels();
  const { pending, runAction } = useCrudToast();
  const [addFinishingNote, setAddFinishingNote] = useState("");
  const [addCustomModification, setAddCustomModification] = useState("");

  const canSubmit = managementEdit || canSubmitCs;
  const canEditGeneralFields = managementEdit || canSubmitCs;

  const formDefaults = useMemo(
    (): FinishingFormInput => ({
      unitId: defaults.unitId,
      packageType: (defaults.packageType ?? "") as FinishingFormInput["packageType"],
      executingCompany: (defaults.executingCompany ?? "") as FinishingFormInput["executingCompany"],
      contractDate: toDateInput(defaults.contractDate),
      datedAt: toDateInput(defaults.datedAt),
      deliveryDate: toDateInput(defaults.deliveryDate),
      emailDate: toDateInput(defaults.emailDate),
      pricePerMeter: defaults.pricePerMeter ?? "",
      totalFinishingPrice: defaults.totalFinishingPrice ?? "",
      doorFees: defaults.doorFees ?? "",
      aluminumFees: defaults.aluminumFees ?? "",
      phases: (defaults.phases.length
        ? defaults.phases
        : ["NOT_STARTED"]) as FinishingFormInput["phases"],
      currentFinishingStatus: defaults.currentFinishingStatus ?? "",
      customModifications: defaults.customModifications ?? "",
      modificationsCompleted: defaults.modificationsCompleted,
    }),
    [defaults]
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
  } = useForm<FinishingFormInput>({
    resolver: zodResolver(finishingFormSchema),
    defaultValues: formDefaults,
  });

  const watched = watch();

  const checklistPackageType = useMemo((): FinishingPackage | null => {
    const raw = watched.packageType || defaults.packageType;
    return raw && raw !== "" ? (raw as FinishingPackage) : null;
  }, [watched.packageType, defaults.packageType]);

  const packageItems = useMemo(() => {
    const items: Record<string, string> = { "": tCommon("all") };
    for (const value of FINISHING_PACKAGE_OPTIONS) {
      items[value] = labels.finishingPackage(value);
    }
    return items;
  }, [labels, tCommon]);

  const companyItems = useMemo(() => {
    const items: Record<string, string> = { "": tCommon("all") };
    for (const value of EXECUTING_COMPANY_OPTIONS) {
      items[value] = labels.executingCompany(value);
    }
    return items;
  }, [labels, tCommon]);

  const selectedPhases = normalizeFinishingPhases(
    Array.isArray(watched.phases) && watched.phases.length
      ? (watched.phases as FinishingFormInput["phases"])
      : defaults.phases.length
        ? (defaults.phases as FinishingFormInput["phases"])
        : ["NOT_STARTED"]
  );

  const customModsText = String(watched.customModifications ?? "").trim();
  const hasCustomMods = customModsText.length > 0;

  const packageTypeChanged =
    String(watched.packageType ?? "") !== String(defaults.packageType ?? "");
  const executingCompanyChanged =
    String(watched.executingCompany ?? "") !==
    String(defaults.executingCompany ?? "");

  function onSubmit(values: FinishingFormInput) {
    if (managementEdit) {
      const trimmedMods = String(values.customModifications ?? "").trim();
      const payload: FinishingFormInput = {
        ...values,
        customModifications: trimmedMods || null,
        modificationsCompleted: trimmedMods ? values.modificationsCompleted ?? false : true,
      };
      runAction(() => updateFinishing(payload), "saved");
      return;
    }

    if (canSubmitCs) {
      runAction(async () => {
        const result = await updateCsFinishingAdditions({
          unitId: values.unitId,
          addFinishingNote: addFinishingNote.trim() || null,
          addCustomModification: addCustomModification.trim() || null,
          packageType:
            values.packageType === "" || values.packageType == null
              ? null
              : values.packageType,
          executingCompany:
            values.executingCompany === "" || values.executingCompany == null
              ? null
              : values.executingCompany,
        });
        if (result.success) {
          setAddFinishingNote("");
          setAddCustomModification("");
          router.refresh();
        }
        return result;
      }, "saved");
    }
  }

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-premium ring-1 ring-primary/20">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
              <HardHat className="size-5" />
            </div>
            <div className="space-y-1 text-start">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {tFinishing("phaseBannerLabel")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sortPhases(selectedPhases).map((phase) => (
                  <Badge key={phase} variant="secondary" className="text-sm">
                    {labels.finishingPhase(phase)}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {tFinishing("phaseBannerHint")}
              </p>
            </div>
          </div>
          <div className="w-full sm:max-w-md">
            <Controller
              control={control}
              name="phases"
              render={({ field }) => (
                <FinishingPhasePicker
                  value={normalizeFinishingPhases(field.value ?? [])}
                  onChange={field.onChange}
                  disabled={!managementEdit || pending}
                  packageType={checklistPackageType}
                  label={tFinishing("phaseBannerLabel")}
                  hint={tFinishing("phaseMultiHint")}
                  disabledHint={tFinishing("phaseChecklistDisabled")}
                  selectAllLabel={tFinishingPhases("selectAll")}
                  labelForPhase={labels.finishingPhase}
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={tFinishing("packageType")} value={packageDisplayLabel} />
        <SummaryCard label={tFinishing("executingCompany")} value={companyDisplayLabel} />
        <SummaryCard
          label={t("pricePerMeter")}
          value={formatCurrency(
            typeof watched.pricePerMeter === "number"
              ? watched.pricePerMeter
              : defaults.pricePerMeter,
            locale
          )}
        />
        <SummaryCard
          label={t("totalPrice")}
          value={formatCurrency(
            typeof watched.totalFinishingPrice === "number"
              ? watched.totalFinishingPrice
              : defaults.totalFinishingPrice,
            locale
          )}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <input type="hidden" {...register("unitId")} />
        <input type="hidden" {...register("emailDate")} />

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionGeneral")}</CardTitle>
            {canSubmitCs ? (
              <p className="text-sm text-muted-foreground">
                {tFinishing("csAgentHint")}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{tFinishing("packageType")}</Label>
              <Controller
                control={control}
                name="packageType"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(value) => field.onChange(value ?? "")}
                    items={packageItems}
                    disabled={!canEditGeneralFields || pending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={tCommon("all")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{tCommon("all")}</SelectItem>
                      {FINISHING_PACKAGE_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {labels.finishingPackage(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>{tFinishing("executingCompany")}</Label>
              <Controller
                control={control}
                name="executingCompany"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(value) => field.onChange(value ?? "")}
                    items={companyItems}
                    disabled={!canEditGeneralFields || pending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={tCommon("all")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{tCommon("all")}</SelectItem>
                      {EXECUTING_COMPANY_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {labels.executingCompany(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="currentFinishingStatus">
                {tFinishing("finishingNotes")}
              </Label>
              {canSubmitCs ? (
                <>
                  {defaults.currentFinishingStatus ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                      {defaults.currentFinishingStatus}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {tFinishing("noNotesYet")}
                    </p>
                  )}
                  <Label htmlFor="addFinishingNote">{tFinishing("addFinishingNote")}</Label>
                  <Textarea
                    id="addFinishingNote"
                    rows={3}
                    disabled={pending}
                    placeholder={tFinishing("addFinishingNotePlaceholder")}
                    className="min-h-20 resize-y text-start"
                    value={addFinishingNote}
                    onChange={(event) => setAddFinishingNote(event.target.value)}
                  />
                </>
              ) : (
                <Textarea
                  id="currentFinishingStatus"
                  rows={4}
                  disabled={!managementEdit || pending}
                  placeholder={tFinishing("finishingNotesPlaceholder")}
                  className="min-h-24 resize-y text-start"
                  {...register("currentFinishingStatus")}
                />
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="customModifications">{tEdge("customModifications")}</Label>
              {canSubmitCs ? (
                <>
                  {defaults.customModifications ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                      {defaults.customModifications}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {tFinishing("noModificationsYet")}
                    </p>
                  )}
                  <Label htmlFor="addCustomModification">
                    {tFinishing("addCustomModification")}
                  </Label>
                  <Textarea
                    id="addCustomModification"
                    rows={3}
                    disabled={pending}
                    placeholder={tFinishing("addCustomModificationPlaceholder")}
                    className="min-h-20 resize-y text-start"
                    value={addCustomModification}
                    onChange={(event) => setAddCustomModification(event.target.value)}
                  />
                </>
              ) : (
                <Textarea
                  id="customModifications"
                  rows={3}
                  disabled={!managementEdit || pending}
                  className="min-h-20 resize-y text-start"
                  {...register("customModifications")}
                />
              )}
            </div>
            {hasCustomMods || defaults.customModifications ? (
              <div className="flex items-start gap-3 md:col-span-2">
                <input
                  id="modificationsCompleted"
                  type="checkbox"
                  className="mt-1 size-4 rounded border"
                  disabled={!managementEdit || pending}
                  {...register("modificationsCompleted")}
                />
                <Label htmlFor="modificationsCompleted" className="font-normal leading-snug">
                  {tEdge("modificationsCompleted")}
                  {canSubmitCs ? (
                    <span className="ms-1 text-xs text-muted-foreground">
                      ({tFinishing("managementOnly")})
                    </span>
                  ) : null}
                </Label>
              </div>
            ) : null}
            <div className="md:col-span-2">
              <UnitDocumentUpload
                unitId={defaults.unitId}
                documentType="finishingContract"
                existingFile={defaults.finishingContractFile}
                canUpload={canUploadDocuments}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionFinancials")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pricePerMeter">{tFinishing("pricePerMeter")}</Label>
              <Input
                id="pricePerMeter"
                type="number"
                step="any"
                disabled={!managementEdit || pending}
                {...register("pricePerMeter")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalFinishingPrice">{tFinishing("totalPrice")}</Label>
              <Input
                id="totalFinishingPrice"
                type="number"
                step="any"
                disabled={!managementEdit || pending}
                {...register("totalFinishingPrice")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doorFees">{tFinishing("doorFees")}</Label>
              <Input
                id="doorFees"
                type="number"
                step="any"
                disabled={!managementEdit || pending}
                {...register("doorFees")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aluminumFees">{tFinishing("aluminumFees")}</Label>
              <Input
                id="aluminumFees"
                type="number"
                step="any"
                disabled={!managementEdit || pending}
                {...register("aluminumFees")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionDates")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Controller
              control={control}
              name="contractDate"
              render={({ field }) => (
                <DatePickerField
                  id="contractDate"
                  label={tFinishing("contractDate")}
                  value={String(field.value ?? "")}
                  onChange={field.onChange}
                  disabled={!managementEdit || pending}
                  locale={locale}
                />
              )}
            />
            <Controller
              control={control}
              name="datedAt"
              render={({ field }) => (
                <DatePickerField
                  id="datedAt"
                  label={t("datedAt")}
                  value={String(field.value ?? "")}
                  onChange={field.onChange}
                  disabled={!managementEdit || pending}
                  locale={locale}
                />
              )}
            />
            <Controller
              control={control}
              name="deliveryDate"
              render={({ field }) => (
                <DatePickerField
                  id="deliveryDate"
                  label={tFields("deliveryDate")}
                  value={String(field.value ?? "")}
                  onChange={field.onChange}
                  disabled={!managementEdit || pending}
                  locale={locale}
                />
              )}
            />
          </CardContent>
        </Card>

        {canSubmit ? (
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                pending ||
                (canSubmitCs &&
                  !addFinishingNote.trim() &&
                  !addCustomModification.trim() &&
                  !packageTypeChanged &&
                  !executingCompanyChanged)
              }
            >
              {canSubmitCs &&
              !packageTypeChanged &&
              !executingCompanyChanged &&
              (addFinishingNote.trim() || addCustomModification.trim())
                ? tFinishing("addNotes")
                : tCommon("save")}
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
