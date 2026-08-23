"use client";

import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";

import { updateUnitProfile } from "@/lib/actions/crm";
import {
  UNIT_TYPE_OPTIONS,
  unitProfileFormSchema,
  type UnitProfileFormInput,
} from "@/lib/validations/unit-profile";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { ClientPhoneRow } from "@/components/units/client-phone-row";
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

export type UnitClientFormDefaults = {
  unitId: string;
  clientName: string;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  address1: string | null;
  address2: string | null;
  deliveryYear: string | null;
  gracePeriod: string | null;
  type: string;
  unitCode: string;
  projectName: string;
  agentLabel: string;
  areaLabel: string;
  waMessageTemplate: string;
};

export function UnitClientForm({
  defaults,
  canEdit,
}: {
  defaults: UnitClientFormDefaults;
  canEdit: boolean;
}) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const t = useTranslations("units");
  const tClient = useTranslations("client");
  const tUnit = useTranslations("unit");
  const tCommon = useTranslations("common");
  const labels = useDomainLabels();
  const { pending, runAction } = useCrudToast();

  const formDefaults = useMemo(
    (): UnitProfileFormInput => ({
      unitId: defaults.unitId,
      address1: defaults.address1 ?? "",
      address2: defaults.address2 ?? "",
      deliveryYear: defaults.deliveryYear ?? "",
      gracePeriod: defaults.gracePeriod ?? "",
      type: defaults.type as UnitProfileFormInput["type"],
    }),
    [defaults]
  );

  const {
    register,
    control,
    handleSubmit,
  } = useForm<UnitProfileFormInput>({
    resolver: zodResolver(unitProfileFormSchema),
    defaultValues: formDefaults,
  });

  const typeItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const value of UNIT_TYPE_OPTIONS) {
      items[value] = labels.unitType(value);
    }
    return items;
  }, [labels]);

  function onSubmit(values: UnitProfileFormInput) {
    runAction(() => updateUnitProfile(values), "saved");
  }

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <Card>
        <CardHeader>
          <CardTitle>{t("clientInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>{t("client")}:</strong> {defaults.clientName}
          </p>
          <ClientPhoneRow
            label={t("phone1")}
            phone={defaults.phone1}
            clientName={defaults.clientName}
            unitCode={defaults.unitCode}
            projectName={defaults.projectName}
            messageTemplate={defaults.waMessageTemplate}
          />
          <ClientPhoneRow
            label={t("phone2")}
            phone={defaults.phone2}
            clientName={defaults.clientName}
            unitCode={defaults.unitCode}
            projectName={defaults.projectName}
            messageTemplate={defaults.waMessageTemplate}
          />
          <p>
            <strong>{tCommon("email")}:</strong> {defaults.email ?? "—"}
          </p>
          <p>
            <strong>{t("area")}:</strong> {defaults.areaLabel}
          </p>
          <p>
            <strong>{t("agent")}:</strong> {defaults.agentLabel}
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <input type="hidden" {...register("unitId")} />

        <Card>
          <CardHeader>
            <CardTitle>{tClient("address1")} / {tClient("address2")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="address1">{tClient("address1")}</Label>
              <Input
                id="address1"
                disabled={!canEdit || pending}
                {...register("address1")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address2">{tClient("address2")}</Label>
              <Input
                id="address2"
                disabled={!canEdit || pending}
                {...register("address2")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("type")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>{t("type")}</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={typeItems}
                    disabled={!canEdit || pending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPE_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {labels.unitType(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryYear">{tUnit("deliveryYear")}</Label>
              <Input
                id="deliveryYear"
                disabled={!canEdit || pending}
                placeholder="2028"
                {...register("deliveryYear")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gracePeriod">{tUnit("gracePeriod")}</Label>
              <Input
                id="gracePeriod"
                disabled={!canEdit || pending}
                {...register("gracePeriod")}
              />
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
    </div>
  );
}
