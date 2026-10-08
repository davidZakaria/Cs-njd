"use client";

import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  updateCsHandoverChecklist,
  updateHandoverChecklist,
} from "@/lib/actions/crm";
import {
  HANDOVER_STATUS_OPTIONS,
  csHandoverChecklistSchema,
  handoverChecklistSchema,
  type HandoverChecklistFormInput,
} from "@/lib/validations/workflow";
import { CS_HANDOVER_CHECKLIST_FIELDS } from "@/lib/workflow/cs-handover-fields";
import { isDhlSectionActive } from "@/lib/workflow/handover-dhl-gate";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  hasPreliminarySaleContract: boolean;
  hasSignedProtocol: boolean;
  signedProtocolDate: string | null;
  hasSignedExtension: boolean;
  signedExtensionDate: string | null;
  hasFinalSaleContract: boolean;
  finalSaleContractDate: string | null;
  hasPaidFees: boolean;
  papersReceived: boolean;
  powerOfAttorneyReceived: boolean;
  isLegallyBlocked: boolean;
  inspectionDate: string | null;
  siteVisitDone: boolean;
  siteVisitDate1: string | null;
  siteVisitDate2: string | null;
  siteVisitDate3: string | null;
  clientInspectionNotes: string | null;
  dhlSentToClient: boolean;
  dhlSentToClientDate: string | null;
  dhlReceivedFromClient: boolean;
  dhlReceivedFromClientDate: string | null;
  paperHandoverPreliminaryCopy: boolean;
  paperHandoverOriginalProtocol: boolean;
  paperHandoverFinishingPapers: boolean;
  paperHandoverKeyReceived: boolean;
};

const MANAGEMENT_ONLY_FIELDS = new Set([
  "hasPaidFees",
  "isLegallyBlocked",
  "hasPreliminarySaleContract",
  "hasFinalSaleContract",
  "finalSaleContractDate",
]);

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

function canEditChecklistField(
  field: string,
  canEditManagement: boolean,
  canEditCsChecklist: boolean
): boolean {
  if (canEditManagement) return true;
  if (!canEditCsChecklist) return false;
  if (MANAGEMENT_ONLY_FIELDS.has(field)) return false;
  return (CS_HANDOVER_CHECKLIST_FIELDS as readonly string[]).includes(field);
}

function ContractRow({
  id,
  label,
  checked,
  dateValue,
  onCheckChange,
  onDateChange,
  disabled,
  managementOnlyLabel,
}: {
  id: string;
  label: string;
  checked: boolean;
  dateValue: string;
  onCheckChange: (value: boolean) => void;
  onDateChange: (value: string) => void;
  disabled: boolean;
  managementOnlyLabel?: string;
}) {
  const tForm = useTranslations("workflow.contractsHandover");
  return (
    <div className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-1 size-4 rounded border"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckChange(event.target.checked)}
        />
        <Label htmlFor={id} className="font-normal leading-snug">
          {label}
          {managementOnlyLabel ? (
            <span className="ms-1 text-xs text-muted-foreground">
              ({managementOnlyLabel})
            </span>
          ) : null}
        </Label>
      </div>
      <div className="space-y-1 sm:w-44">
        <Label htmlFor={`${id}-date`} className="text-xs text-muted-foreground">
          {tForm("datedOn")}
        </Label>
        <Input
          id={`${id}-date`}
          type="date"
          disabled={disabled}
          value={dateValue}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </div>
    </div>
  );
}

export function UnitLegalHandoverForm({
  defaults,
  canEditManagement = false,
  canEditCsChecklist = false,
  canEdit,
}: {
  defaults: UnitLegalHandoverDefaults;
  canEditManagement?: boolean;
  canEditCsChecklist?: boolean;
  /** @deprecated Use canEditManagement */
  canEdit?: boolean;
}) {
  const managementEdit = canEditManagement || Boolean(canEdit);
  const t = useTranslations("units");
  const tChecklist = useTranslations("workflow.checklist");
  const tEdge = useTranslations("workflow.edgeCases");
  const tForm = useTranslations("workflow.contractsHandover");
  const tCommon = useTranslations("common");
  const labels = useDomainLabels();
  const { pending, runAction } = useCrudToast();

  const canSubmit = managementEdit || canEditCsChecklist;

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
      hasPreliminarySaleContract: defaults.hasPreliminarySaleContract,
      hasSignedProtocol: defaults.hasSignedProtocol,
      signedProtocolDate: toDateInput(defaults.signedProtocolDate),
      hasSignedExtension: defaults.hasSignedExtension,
      signedExtensionDate: toDateInput(defaults.signedExtensionDate),
      hasFinalSaleContract: defaults.hasFinalSaleContract,
      finalSaleContractDate: toDateInput(defaults.finalSaleContractDate),
      hasPaidFees: defaults.hasPaidFees,
      papersReceived: defaults.papersReceived,
      powerOfAttorneyReceived: defaults.powerOfAttorneyReceived,
      isLegallyBlocked: defaults.isLegallyBlocked,
      inspectionDate: toDateInput(defaults.inspectionDate),
      siteVisitDone: defaults.siteVisitDone,
      siteVisitDate1: toDateInput(defaults.siteVisitDate1),
      siteVisitDate2: toDateInput(defaults.siteVisitDate2),
      siteVisitDate3: toDateInput(defaults.siteVisitDate3),
      clientInspectionNotes: defaults.clientInspectionNotes ?? "",
      dhlSentToClient: defaults.dhlSentToClient,
      dhlSentToClientDate: toDateInput(defaults.dhlSentToClientDate),
      dhlReceivedFromClient: defaults.dhlReceivedFromClient,
      dhlReceivedFromClientDate: toDateInput(defaults.dhlReceivedFromClientDate),
      paperHandoverPreliminaryCopy: defaults.paperHandoverPreliminaryCopy,
      paperHandoverOriginalProtocol: defaults.paperHandoverOriginalProtocol,
      paperHandoverFinishingPapers: defaults.paperHandoverFinishingPapers,
      paperHandoverKeyReceived: defaults.paperHandoverKeyReceived,
    },
  });

  const siteVisitDone = Boolean(form.watch("siteVisitDone"));
  const dhlActive = isDhlSectionActive(siteVisitDone);

  function fieldDisabled(field: string) {
    return (
      !canEditChecklistField(field, managementEdit, canEditCsChecklist) ||
      pending
    );
  }

  function onSubmit(values: HandoverChecklistFormInput) {
    if (managementEdit) {
      const parsed = handoverChecklistSchema.parse(values);
      runAction(() => updateHandoverChecklist(parsed), "saved");
      return;
    }

    if (canEditCsChecklist) {
      const parsed = csHandoverChecklistSchema.parse({
        unitId: values.unitId,
        hasSignedProtocol: values.hasSignedProtocol,
        signedProtocolDate: values.signedProtocolDate,
        hasSignedExtension: values.hasSignedExtension,
        signedExtensionDate: values.signedExtensionDate,
        papersReceived: values.papersReceived,
        powerOfAttorneyReceived: values.powerOfAttorneyReceived,
        inspectionDate: values.inspectionDate,
        siteVisitDone: values.siteVisitDone,
        siteVisitDate1: values.siteVisitDate1,
        siteVisitDate2: values.siteVisitDate2,
        siteVisitDate3: values.siteVisitDate3,
        clientInspectionNotes: values.clientInspectionNotes,
        dhlSentToClient: values.dhlSentToClient,
        dhlSentToClientDate: values.dhlSentToClientDate,
        dhlReceivedFromClient: values.dhlReceivedFromClient,
        dhlReceivedFromClientDate: values.dhlReceivedFromClientDate,
        paperHandoverPreliminaryCopy: values.paperHandoverPreliminaryCopy,
        paperHandoverOriginalProtocol: values.paperHandoverOriginalProtocol,
        paperHandoverFinishingPapers: values.paperHandoverFinishingPapers,
        paperHandoverKeyReceived: values.paperHandoverKeyReceived,
      });
      runAction(() => updateCsHandoverChecklist(parsed), "saved");
    }
  }

  const paperFields = [
    {
      field: "paperHandoverPreliminaryCopy" as const,
      label: tForm("paperPreliminaryCopy"),
    },
    {
      field: "paperHandoverOriginalProtocol" as const,
      label: tForm("paperOriginalProtocol"),
    },
    {
      field: "paperHandoverFinishingPapers" as const,
      label: tForm("paperFinishingPapers"),
    },
    {
      field: "paperHandoverKeyReceived" as const,
      label: tForm("paperKeyHandover"),
    },
  ];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...form.register("unitId")} />

      {managementEdit ? (
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
                    disabled={pending}
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
                disabled={pending}
                {...form.register("actionLabel")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractDate">{t("contractDate")}</Label>
              <Input
                id="contractDate"
                type="date"
                disabled={pending}
                value={String(form.watch("contractDate") ?? "")}
                onChange={(event) =>
                  form.setValue("contractDate", event.target.value)
                }
              />
              <p className="text-xs text-muted-foreground">{tForm("contractDateHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">{t("deliveryDate")}</Label>
              <Input
                id="deliveryDate"
                type="date"
                disabled={pending}
                value={String(form.watch("deliveryDate") ?? "")}
                onChange={(event) =>
                  form.setValue("deliveryDate", event.target.value)
                }
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{tForm("contractsTitle")}</CardTitle>
          {canEditCsChecklist && !managementEdit ? (
            <p className="text-sm text-muted-foreground">{tChecklist("csAgentHint")}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {managementEdit ? (
            <ContractRow
              id="hasPreliminarySaleContract"
              label={tForm("preliminarySaleContract")}
              checked={Boolean(form.watch("hasPreliminarySaleContract"))}
              dateValue={String(form.watch("contractDate") ?? "")}
              onCheckChange={(value) =>
                form.setValue("hasPreliminarySaleContract", value)
              }
              onDateChange={(value) => form.setValue("contractDate", value)}
              disabled={fieldDisabled("hasPreliminarySaleContract")}
              managementOnlyLabel={tChecklist("managementOnly")}
            />
          ) : null}
          <ContractRow
            id="hasSignedExtension"
            label={tForm("saleContractAnnex")}
            checked={Boolean(form.watch("hasSignedExtension"))}
            dateValue={String(form.watch("signedExtensionDate") ?? "")}
            onCheckChange={(value) => form.setValue("hasSignedExtension", value)}
            onDateChange={(value) => form.setValue("signedExtensionDate", value)}
            disabled={fieldDisabled("hasSignedExtension")}
          />
          <ContractRow
            id="hasSignedProtocol"
            label={tForm("handoverRecord")}
            checked={Boolean(form.watch("hasSignedProtocol"))}
            dateValue={String(form.watch("signedProtocolDate") ?? "")}
            onCheckChange={(value) => form.setValue("hasSignedProtocol", value)}
            onDateChange={(value) => form.setValue("signedProtocolDate", value)}
            disabled={fieldDisabled("hasSignedProtocol")}
          />
          {managementEdit ? (
            <ContractRow
              id="hasFinalSaleContract"
              label={tForm("finalSaleContract")}
              checked={Boolean(form.watch("hasFinalSaleContract"))}
              dateValue={String(form.watch("finalSaleContractDate") ?? "")}
              onCheckChange={(value) => form.setValue("hasFinalSaleContract", value)}
              onDateChange={(value) => form.setValue("finalSaleContractDate", value)}
              disabled={fieldDisabled("hasFinalSaleContract")}
              managementOnlyLabel={tChecklist("managementOnly")}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tForm("siteVisitSectionTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <input
              id="siteVisitDone"
              type="checkbox"
              className="mt-1 size-4 rounded border"
              disabled={fieldDisabled("siteVisitDone")}
              {...form.register("siteVisitDone")}
            />
            <Label htmlFor="siteVisitDone" className="font-normal leading-snug">
              {tForm("siteVisitDone")}
            </Label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["siteVisitDate1", tForm("siteVisitDate1")],
                ["siteVisitDate2", tForm("siteVisitDate2")],
                ["siteVisitDate3", tForm("siteVisitDate3")],
              ] as const
            ).map(([name, label]) => (
              <div key={name} className="space-y-2">
                <Label htmlFor={name}>{label}</Label>
                <Input
                  id={name}
                  type="date"
                  disabled={fieldDisabled(name)}
                  value={String(form.watch(name) ?? "")}
                  onChange={(event) => form.setValue(name, event.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientInspectionNotes">{tForm("clientInspectionNotes")}</Label>
            <Textarea
              id="clientInspectionNotes"
              rows={3}
              disabled={fieldDisabled("clientInspectionNotes")}
              placeholder={tForm("clientInspectionNotesPlaceholder")}
              {...form.register("clientInspectionNotes")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inspectionDate">{tEdge("inspectionDate")}</Label>
            <Input
              id="inspectionDate"
              type="date"
              disabled={fieldDisabled("inspectionDate")}
              value={String(form.watch("inspectionDate") ?? "")}
              onChange={(event) => form.setValue("inspectionDate", event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={cn(!dhlActive && "opacity-70")}>
        <CardHeader>
          <CardTitle>{tForm("dhlTitle")}</CardTitle>
          {!dhlActive ? (
            <p className="text-sm text-muted-foreground">{tForm("dhlLockedHint")}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          <fieldset disabled={!dhlActive} className="space-y-3">
            <ContractRow
              id="dhlSentToClient"
              label={tForm("dhlSentToClient")}
              checked={Boolean(form.watch("dhlSentToClient"))}
              dateValue={String(form.watch("dhlSentToClientDate") ?? "")}
              onCheckChange={(value) => form.setValue("dhlSentToClient", value)}
              onDateChange={(value) => form.setValue("dhlSentToClientDate", value)}
              disabled={fieldDisabled("dhlSentToClient") || !dhlActive}
            />
            <ContractRow
              id="dhlReceivedFromClient"
              label={tForm("dhlReceivedFromClient")}
              checked={Boolean(form.watch("dhlReceivedFromClient"))}
              dateValue={String(form.watch("dhlReceivedFromClientDate") ?? "")}
              onCheckChange={(value) => form.setValue("dhlReceivedFromClient", value)}
              onDateChange={(value) =>
                form.setValue("dhlReceivedFromClientDate", value)
              }
              disabled={fieldDisabled("dhlReceivedFromClient") || !dhlActive}
            />
            <div className="flex items-start gap-3 pt-1">
              <input
                id="powerOfAttorneyReceived"
                type="checkbox"
                className="mt-1 size-4 rounded border"
                disabled={fieldDisabled("powerOfAttorneyReceived") || !dhlActive}
                {...form.register("powerOfAttorneyReceived")}
              />
              <Label htmlFor="powerOfAttorneyReceived" className="font-normal leading-snug">
                {tEdge("powerOfAttorneyReceived")}
              </Label>
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tForm("paperHandoverTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {paperFields.map(({ field, label }) => (
            <div key={field} className="flex items-start gap-3">
              <input
                id={field}
                type="checkbox"
                className="mt-1 size-4 rounded border"
                disabled={fieldDisabled(field)}
                {...form.register(field)}
              />
              <Label htmlFor={field} className="font-normal leading-snug">
                {label}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tChecklist("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <input
              id="hasPaidFees"
              type="checkbox"
              className="mt-1 size-4 rounded border"
              disabled={fieldDisabled("hasPaidFees")}
              {...form.register("hasPaidFees")}
            />
            <Label htmlFor="hasPaidFees" className="font-normal leading-snug">
              {tChecklist("paidFees")}
              {canEditCsChecklist && !managementEdit ? (
                <span className="ms-1 text-xs text-muted-foreground">
                  ({tChecklist("managementOnly")})
                </span>
              ) : null}
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <input
              id="papersReceived"
              type="checkbox"
              className="mt-1 size-4 rounded border"
              disabled={fieldDisabled("papersReceived")}
              {...form.register("papersReceived")}
            />
            <Label htmlFor="papersReceived" className="font-normal leading-snug">
              {tChecklist("papersReceived")}
            </Label>
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
              disabled={fieldDisabled("isLegallyBlocked")}
              {...form.register("isLegallyBlocked")}
            />
            <Label
              htmlFor="isLegallyBlocked"
              className="font-medium leading-snug text-destructive"
            >
              {tEdge("isLegallyBlocked")}
              {canEditCsChecklist && !managementEdit ? (
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  ({tChecklist("managementOnly")})
                </span>
              ) : null}
            </Label>
          </div>
        </CardContent>
      </Card>

      {canSubmit ? (
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
