"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { updateHandoverChecklist } from "@/lib/actions/crm";
import {
  handoverChecklistSchema,
  type HandoverChecklistFormInput,
} from "@/lib/validations/workflow";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type HandoverChecklistDefaults = {
  unitId: string;
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

export function HandoverChecklistForm({
  defaults,
  canEdit,
}: {
  defaults: HandoverChecklistDefaults;
  canEdit: boolean;
}) {
  const t = useTranslations("workflow.checklist");
  const tEdge = useTranslations("workflow.edgeCases");
  const tCommon = useTranslations("common");
  const { pending, runAction } = useCrudToast();

  const form = useForm<HandoverChecklistFormInput>({
    resolver: zodResolver(handoverChecklistSchema),
    defaultValues: {
      unitId: defaults.unitId,
      hasSignedProtocol: defaults.hasSignedProtocol,
      hasSignedExtension: defaults.hasSignedExtension,
      hasPaidFees: defaults.hasPaidFees,
      papersReceived: defaults.papersReceived,
      powerOfAttorneyReceived: defaults.powerOfAttorneyReceived,
      isLegallyBlocked: defaults.isLegallyBlocked,
      inspectionDate: defaults.inspectionDate
        ? format(new Date(defaults.inspectionDate), "yyyy-MM-dd")
        : "",
    },
  });

  const checkboxLabels: Record<(typeof CHECKBOX_FIELDS)[number], string> = {
    hasSignedProtocol: t("signedProtocol"),
    hasSignedExtension: t("signedExtension"),
    hasPaidFees: t("paidFees"),
    papersReceived: t("papersReceived"),
    powerOfAttorneyReceived: tEdge("powerOfAttorneyReceived"),
  };

  function onSubmit(values: HandoverChecklistFormInput) {
    const parsed = handoverChecklistSchema.parse(values);
    runAction(() => updateHandoverChecklist(parsed), "saved");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...form.register("unitId")} />
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
            <Controller
              control={form.control}
              name="inspectionDate"
              render={({ field }) => (
                <Input
                  id="inspectionDate"
                  type="date"
                  disabled={!canEdit || pending}
                  value={String(field.value ?? "")}
                  onChange={(event) => {
                    field.onChange(event.target.value);
                  }}
                />
              )}
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

          {canEdit ? (
            <Button type="submit" disabled={pending}>
              {tCommon("save")}
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
