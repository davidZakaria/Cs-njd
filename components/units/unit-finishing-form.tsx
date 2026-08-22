"use client";

import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { updateFinishing } from "@/lib/actions/crm";
import { formatCurrency } from "@/lib/format/currency";
import {
  EXECUTING_COMPANY_OPTIONS,
  FINISHING_PACKAGE_OPTIONS,
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
import { cn } from "@/lib/utils";

export type FinishingFormDefaults = {
  unitId: string;
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
}: {
  defaults: FinishingFormDefaults;
  canEdit: boolean;
  packageDisplayLabel: string;
  companyDisplayLabel: string;
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

  function onSubmit(values: FinishingFormInput) {
    runAction(() => updateFinishing(values), "saved");
  }

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
        <SummaryCard
          label={tFinishing("currentStatus")}
          value={
            typeof watched.currentFinishingStatus === "string" &&
            watched.currentFinishingStatus.trim()
              ? watched.currentFinishingStatus
              : defaults.currentFinishingStatus ?? "—"
          }
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
                {tFinishing("currentStatus")}
              </Label>
              <Input
                id="currentFinishingStatus"
                disabled={!canEdit || pending}
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
                <DatePickerField
                  id="emailDate"
                  label={t("emailDate")}
                  value={String(field.value ?? "")}
                  onChange={field.onChange}
                  disabled={!canEdit || pending}
                  locale={locale}
                />
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
