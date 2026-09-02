"use client";

import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { updateHandoverChecklist } from "@/lib/actions/crm";
import {
  HANDOVER_STATUS_OPTIONS,
  handoverChecklistSchema,
  type HandoverChecklistFormInput,
} from "@/lib/validations/workflow";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type UnitLegalHandoverDefaults = {
  unitId: string;
  handoverStatus: string;
  actionLabel: string | null;
  contractDate: string | null;
  deliveryDate: string | null;
  hasSignedProtocol: boolean;
  hasSignedExtension: boolean;
  hasPaidFees: boolean;
  papersReceived: boolean;
  powerOfAttorneyReceived: boolean;
  isLegallyBlocked: boolean;
  inspectionDate: string | null;
};

const CHECKBOX_FIELDS = [
  "hasSignedProtocol",
  "hasSignedExtension",
  "hasPaidFees",
  "papersReceived",
  "powerOfAttorneyReceived",
] as const;

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

export function UnitLegalHandoverForm({
  defaults,
  canEdit,
}: {
  defaults: UnitLegalHandoverDefaults;
  canEdit: boolean;
}) {
  const t = useTranslations("units");
  const tChecklist = useTranslations("workflow.checklist");
  const tEdge = useTranslations("workflow.edgeCases");
  const tCommon = useTranslations("common");
  const labels = useDomainLabels();
  const { pending, runAction } = useCrudToast();

  const handoverStatusItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const status of HANDOVER_STATUS_OPTIONS) {
      items[status] = labels.handoverStatus(status);
    }
    return items;
  }, [labels]);

  const form = useForm<HandoverChecklistFormInput>({
    resolver: zodResolver(handoverChecklistSchema),
    defaultValues: {
      unitId: defaults.unitId,
      handoverStatus: defaults.handoverStatus as HandoverChecklistFormInput["handoverStatus"],
      actionLabel: defaults.actionLabel ?? "",
      contractDate: toDateInput(defaults.contractDate),
      deliveryDate: toDateInput(defaults.deliveryDate),
      hasSignedProtocol: defaults.hasSignedProtocol,
      hasSignedExtension: defaults.hasSignedExtension,
      hasPaidFees: defaults.hasPaidFees,
      papersReceived: defaults.papersReceived,
      powerOfAttorneyReceived: defaults.powerOfAttorneyReceived,
      isLegallyBlocked: defaults.isLegallyBlocked,
      inspectionDate: toDateInput(defaults.inspectionDate),
    },
  });

  const checkboxLabels: Record<(typeof CHECKBOX_FIELDS)[number], string> = {
    hasSignedProtocol: tChecklist("signedProtocol"),
    hasSignedExtension: tChecklist("signedExtension"),
    hasPaidFees: tChecklist("paidFees"),
    papersReceived: tChecklist("papersReceived"),
    powerOfAttorneyReceived: tEdge("powerOfAttorneyReceived"),
  };

  function onSubmit(values: HandoverChecklistFormInput) {
    const parsed = handoverChecklistSchema.parse(values);
    runAction(() => updateHandoverChecklist(parsed), "saved");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...form.register("unitId")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("legalStatus")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>{t("handoverStatus")}</Label>
            <Controller
              control={form.control}
              name="handoverStatus"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={handoverStatusItems}
                  disabled={!canEdit || pending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HANDOVER_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {labels.handoverStatus(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="actionLabel">{t("actionLabel")}</Label>
            <Input
              id="actionLabel"
              disabled={!canEdit || pending}
              {...form.register("actionLabel")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractDate">{t("contractDate")}</Label>
            <Input
              id="contractDate"
              type="date"
              disabled={!canEdit || pending}
              value={String(form.watch("contractDate") ?? "")}
              onChange={(event) => form.setValue("contractDate", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliveryDate">{t("deliveryDate")}</Label>
            <Input
              id="deliveryDate"
              type="date"
              disabled={!canEdit || pending}
              value={String(form.watch("deliveryDate") ?? "")}
              onChange={(event) => form.setValue("deliveryDate", event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tChecklist("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {CHECKBOX_FIELDS.map((field) => (
            <div key={field} className="flex items-start gap-3">
              <input
                id={field}
                type="checkbox"
                className="mt-1 size-4 rounded border"
                disabled={!canEdit || pending}
                {...form.register(field)}
              />
              <Label
                htmlFor={field}
                className={cn(
                  "font-normal leading-snug",
                  !canEdit && "text-muted-foreground"
                )}
              >
                {checkboxLabels[field]}
              </Label>
            </div>
          ))}

          <div className="space-y-2">
            <Label htmlFor="inspectionDate">{tEdge("inspectionDate")}</Label>
            <Input
              id="inspectionDate"
              type="date"
              disabled={!canEdit || pending}
              value={String(form.watch("inspectionDate") ?? "")}
              onChange={(event) => form.setValue("inspectionDate", event.target.value)}
            />
          </div>

          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border-2 border-destructive/50 bg-destructive/5 p-3"
            )}
          >
            <input
              id="isLegallyBlocked"
              type="checkbox"
              className="mt-1 size-4 rounded border border-destructive"
              disabled={!canEdit || pending}
              {...form.register("isLegallyBlocked")}
            />
            <Label
              htmlFor="isLegallyBlocked"
              className="font-medium leading-snug text-destructive"
            >
              {tEdge("isLegallyBlocked")}
            </Label>
          </div>
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
  );
}

/** @deprecated Use UnitLegalHandoverForm */
export const HandoverChecklistForm = UnitLegalHandoverForm;
export type HandoverChecklistDefaults = UnitLegalHandoverDefaults;
