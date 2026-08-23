"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { updateHandoverChecklist } from "@/lib/actions/crm";
import {
  handoverChecklistSchema,
  type HandoverChecklistInput,
} from "@/lib/validations/workflow";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type HandoverChecklistDefaults = {
  unitId: string;
  hasSignedProtocol: boolean;
  hasSignedExtension: boolean;
  hasPaidFees: boolean;
  papersReceived: boolean;
};

const CHECKLIST_FIELDS = [
  "hasSignedProtocol",
  "hasSignedExtension",
  "hasPaidFees",
  "papersReceived",
] as const;

export function HandoverChecklistForm({
  defaults,
  canEdit,
}: {
  defaults: HandoverChecklistDefaults;
  canEdit: boolean;
}) {
  const t = useTranslations("workflow.checklist");
  const tCommon = useTranslations("common");
  const { pending, runAction } = useCrudToast();

  const form = useForm<HandoverChecklistInput>({
    resolver: zodResolver(handoverChecklistSchema),
    defaultValues: {
      unitId: defaults.unitId,
      hasSignedProtocol: defaults.hasSignedProtocol,
      hasSignedExtension: defaults.hasSignedExtension,
      hasPaidFees: defaults.hasPaidFees,
      papersReceived: defaults.papersReceived,
    },
  });

  const labels: Record<(typeof CHECKLIST_FIELDS)[number], string> = {
    hasSignedProtocol: t("signedProtocol"),
    hasSignedExtension: t("signedExtension"),
    hasPaidFees: t("paidFees"),
    papersReceived: t("papersReceived"),
  };

  function onSubmit(values: HandoverChecklistInput) {
    runAction(() => updateHandoverChecklist(values), "saved");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...form.register("unitId")} />
          {CHECKLIST_FIELDS.map((field) => (
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
                {labels[field]}
              </Label>
            </div>
          ))}
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
