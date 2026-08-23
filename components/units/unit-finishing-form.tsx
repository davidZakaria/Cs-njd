"use client";

import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { CalendarIcon, HardHat, Mail } from "lucide-react";

import { updateFinishing } from "@/lib/actions/crm";
import { formatCurrency } from "@/lib/format/currency";
import {
  EXECUTING_COMPANY_OPTIONS,
  FINISHING_PACKAGE_OPTIONS,
  FINISHING_PHASE_OPTIONS,
  finishingFormSchema,
  type FinishingFormInput,
} from "@/lib/validations/finishing";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useDomainLabels } from "@/hooks/use-domain-labels";
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
import { cn } from "@/lib/utils";

export type FinishingFormDefaults = {
  unitId: string;
  phase: string | null;
  packageType: string | null;
  executingCompany: string | null;
  contractDate: string | null;
  datedAt: string | null;
  emailDate: string | null;
  pricePerMeter: number | null;
  totalFinishingPrice: number | null;
  doorFees: number | null;
  aluminumFees: number | null;
  currentFinishingStatus: string | null;
  packageLabel: string | null;
  companyName: string | null;
  finishingType: string | null;
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
  canEdit,
  packageDisplayLabel,
  companyDisplayLabel,
  clientEmail,
}: {
  defaults: FinishingFormDefaults;
  canEdit: boolean;
  packageDisplayLabel: string;
  companyDisplayLabel: string;
  clientEmail: string | null;
}) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const t = useTranslations("units");
  const tFinishing = useTranslations("finishing");
  const tCommon = useTranslations("common");
  const labels = useDomainLabels();
  const { pending, runAction } = useCrudToast();

  const formDefaults = useMemo(
    (): FinishingFormInput => ({
      unitId: defaults.unitId,
      packageType: (defaults.packageType ?? "") as FinishingFormInput["packageType"],
      executingCompany: (defaults.executingCompany ?? "") as FinishingFormInput["executingCompany"],
      contractDate: toDateInput(defaults.contractDate),
      datedAt: toDateInput(defaults.datedAt),
      emailDate: toDateInput(defaults.emailDate),
      pricePerMeter: defaults.pricePerMeter ?? "",
      totalFinishingPrice: defaults.totalFinishingPrice ?? "",
      doorFees: defaults.doorFees ?? "",
      aluminumFees: defaults.aluminumFees ?? "",
      phase: (defaults.phase ?? "NOT_STARTED") as FinishingFormInput["phase"],
      currentFinishingStatus: defaults.currentFinishingStatus ?? "",
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

  const phaseItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const value of FINISHING_PHASE_OPTIONS) {
      items[value] = labels.finishingPhase(value);
    }
    return items;
  }, [labels]);

  const activePhase =
    (typeof watched.phase === "string" && watched.phase) ||
    defaults.phase ||
    "NOT_STARTED";
  const activePhaseLabel = labels.finishingPhase(activePhase);

  function onSubmit(values: FinishingFormInput) {
    runAction(() => updateFinishing(values), "saved");
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
              <p className="text-xl font-bold tracking-tight">{activePhaseLabel}</p>
              <p className="text-sm text-muted-foreground">
                {tFinishing("phaseBannerHint")}
              </p>
            </div>
          </div>
          <div className="w-full min-w-[14rem] space-y-2 sm:max-w-xs">
            <Label>{tFinishing("phaseBannerLabel")}</Label>
            <Controller
              control={control}
              name="phase"
              render={({ field }) => (
                <Select
                  value={field.value ?? "NOT_STARTED"}
                  onValueChange={(value) => field.onChange(value ?? "NOT_STARTED")}
                  items={phaseItems}
                  disabled={!canEdit || pending}
                >
                  <SelectTrigger className="w-full border-primary/30 bg-background/90 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINISHING_PHASE_OPTIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {labels.finishingPhase(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionGeneral")}</CardTitle>
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
                    disabled={!canEdit || pending}
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
                    disabled={!canEdit || pending}
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
              <Textarea
                id="currentFinishingStatus"
                rows={4}
                disabled={!canEdit || pending}
                placeholder={tFinishing("finishingNotesPlaceholder")}
                className="min-h-24 resize-y text-start"
                {...register("currentFinishingStatus")}
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
                disabled={!canEdit || pending}
                {...register("pricePerMeter")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalFinishingPrice">{tFinishing("totalPrice")}</Label>
              <Input
                id="totalFinishingPrice"
                type="number"
                step="any"
                disabled={!canEdit || pending}
                {...register("totalFinishingPrice")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doorFees">{tFinishing("doorFees")}</Label>
              <Input
                id="doorFees"
                type="number"
                step="any"
                disabled={!canEdit || pending}
                {...register("doorFees")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aluminumFees">{tFinishing("aluminumFees")}</Label>
              <Input
                id="aluminumFees"
                type="number"
                step="any"
                disabled={!canEdit || pending}
                {...register("aluminumFees")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionDates")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Controller
              control={control}
              name="contractDate"
              render={({ field }) => (
                <DatePickerField
                  id="contractDate"
                  label={tFinishing("contractDate")}
                  value={String(field.value ?? "")}
                  onChange={field.onChange}
                  disabled={!canEdit || pending}
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
                  disabled={!canEdit || pending}
                  locale={locale}
                />
              )}
            />
            <Controller
              control={control}
              name="emailDate"
              render={({ field }) => (
                <div className="space-y-2">
                  <DatePickerField
                    id="emailDate"
                    label={t("emailDate")}
                    value={String(field.value ?? "")}
                    onChange={field.onChange}
                    disabled={!canEdit || pending}
                    locale={locale}
                  />
                  <p className="text-xs leading-snug text-muted-foreground">
                    {t("emailDateHint")}
                  </p>
                  <div className="flex items-start gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                    <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t("emailSentTo")}</p>
                      {clientEmail ? (
                        <a
                          href={`mailto:${clientEmail}`}
                          className="break-all font-medium text-primary hover:underline"
                          dir="ltr"
                        >
                          {clientEmail}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            />
          </CardContent>
        </Card>

        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {tCommon("save")}
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
