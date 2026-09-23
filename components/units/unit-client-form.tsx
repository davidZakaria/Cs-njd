"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import { deleteUnit, updateUnit } from "@/lib/actions/units";
import {
  UNIT_TYPE_OPTIONS,
  unitProfileFormSchema,
  type UnitProfileFormInput,
} from "@/lib/validations/unit-profile";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { ClientPhoneRow } from "@/components/units/client-phone-row";
import { NationalIdUpload } from "@/components/units/national-id-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currencySuffix } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

export type UnitClientFormDefaults = {
  unitId: string;
  clientName: string;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  nationalId: string | null;
  address1: string | null;
  address2: string | null;
  deliveryYear: string | null;
  gracePeriod: string | null;
  contractPricePerMeter: number | null;
  type: string;
  unitCode: string;
  projectName: string;
  agentLabel: string;
  agentId: string | null;
  area: number | null;
  clientId: string | null;
  nationalIdFile: string | null;
  canUploadNationalId: boolean;
  waMessageTemplate: string;
};

export type UnitProfileEditLevel = "none" | "contact" | "admin";

export function UnitClientForm({
  defaults,
  profileEditLevel,
  hideClientContact = false,
  contactDisabled = false,
  agentOptions = [],
}: {
  defaults: UnitClientFormDefaults;
  profileEditLevel: UnitProfileEditLevel;
  hideClientContact?: boolean;
  contactDisabled?: boolean;
  agentOptions?: Array<{ id: string; name: string }>;
}) {
  const canEditClient = profileEditLevel !== "none";
  const canEditAdmin = profileEditLevel === "admin";
  const locale = useLocale();
  const isRtl = locale === "ar";
  const t = useTranslations("units");
  const tClient = useTranslations("client");
  const tUnit = useTranslations("unit");
  const tFields = useTranslations("fields");
  const tCommon = useTranslations("common");
  const labels = useDomainLabels();
  const router = useRouter();
  const { pending, runAction } = useCrudToast();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const formDefaults = useMemo(
    (): UnitProfileFormInput => ({
      unitId: defaults.unitId,
      clientName: defaults.clientName === "—" ? "" : defaults.clientName,
      phone1: defaults.phone1 ?? "",
      phone2: defaults.phone2 ?? "",
      email: defaults.email ?? "",
      nationalId: defaults.nationalId ?? "",
      address1: defaults.address1 ?? "",
      address2: defaults.address2 ?? "",
      deliveryYear: defaults.deliveryYear ?? "",
      gracePeriod: defaults.gracePeriod ?? "",
      contractPricePerMeter: defaults.contractPricePerMeter ?? "",
      area: defaults.area ?? "",
      type: defaults.type as UnitProfileFormInput["type"],
      unitCode: defaults.unitCode,
      agentId: defaults.agentId ?? "",
    }),
    [defaults]
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
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

  const agentSelectItems = useMemo(() => {
    const items: Record<string, string> = {
      "": labels.unassigned,
    };
    for (const agent of agentOptions) {
      items[agent.id] = labels.staffName(agent.name);
    }
    return items;
  }, [agentOptions, labels]);

  useEffect(() => {
    const current = defaults.agentId ?? "";
    if (current && !agentSelectItems[current]) {
      setValue("agentId", "");
    }
  }, [agentSelectItems, defaults.agentId, setValue]);

  const currencyLabel = currencySuffix(locale);

  function onSubmit(values: UnitProfileFormInput) {
    runAction(() => updateUnit(values), "saved");
  }

  function onConfirmDelete() {
    runAction(async () => {
      const result = await deleteUnit(defaults.unitId);
      if (result.success) {
        setDeleteOpen(false);
        router.push("/units");
        router.refresh();
      }
      return result;
    }, "deleted");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <input type="hidden" {...register("unitId")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("clientInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hideClientContact ? (
            <div className="space-y-2 text-sm">
              <p>
                <strong>{t("client")}:</strong> {t("contactRestricted")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("contactRestrictedHint")}
              </p>
            </div>
          ) : canEditClient ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unitCode">{t("unitCode")}</Label>
                <Input
                  id="unitCode"
                  disabled={pending || !canEditAdmin}
                  readOnly={!canEditAdmin}
                  {...register("unitCode")}
                />
              </div>
              {canEditAdmin ? (
                <div className="space-y-2">
                  <Label htmlFor="agentId">{t("agent")}</Label>
                  <Controller
                    control={control}
                    name="agentId"
                    render={({ field }) => {
                      const raw = field.value ?? "";
                      const resolved =
                        raw && agentSelectItems[raw] ? raw : "";
                      return (
                      <Select
                        value={resolved}
                        onValueChange={field.onChange}
                        items={agentSelectItems}
                        disabled={pending}
                      >
                        <SelectTrigger id="agentId" className="w-full">
                          <SelectValue placeholder={labels.unassigned} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">{labels.unassigned}</SelectItem>
                          {agentOptions.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {labels.staffName(agent.name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      );
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm sm:pt-7">
                  <strong>{t("agent")}:</strong> {defaults.agentLabel}
                </p>
              )}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="clientName">{t("client")}</Label>
                <Input
                  id="clientName"
                  disabled={pending}
                  required
                  {...register("clientName")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone1">{t("phone1")}</Label>
                <Input id="phone1" disabled={pending} {...register("phone1")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone2">{t("phone2")}</Label>
                <Input id="phone2" disabled={pending} {...register("phone2")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{tCommon("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  disabled={pending}
                  {...register("email")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationalId">{tFields("nationalId")}</Label>
                <Input id="nationalId" disabled={pending} {...register("nationalId")} />
              </div>
              <NationalIdUpload
                unitId={defaults.unitId}
                clientId={defaults.clientId}
                hasFile={Boolean(defaults.nationalIdFile)}
                canUpload={defaults.canUploadNationalId}
                onExtractedId={(nationalId) =>
                  setValue("nationalId", nationalId, { shouldDirty: true })
                }
              />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
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
                contactDisabled={contactDisabled}
              />
              <ClientPhoneRow
                label={t("phone2")}
                phone={defaults.phone2}
                clientName={defaults.clientName}
                unitCode={defaults.unitCode}
                projectName={defaults.projectName}
                messageTemplate={defaults.waMessageTemplate}
                contactDisabled={contactDisabled}
              />
              <p>
                <strong>{tCommon("email")}:</strong> {defaults.email ?? "—"}
              </p>
              <p>
                <strong>{tFields("nationalId")}:</strong>{" "}
                {defaults.nationalId ?? "—"}
              </p>
              <NationalIdUpload
                unitId={defaults.unitId}
                clientId={defaults.clientId}
                hasFile={Boolean(defaults.nationalIdFile)}
                canUpload={defaults.canUploadNationalId}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="area">{t("area")}</Label>
              {canEditAdmin ? (
                <div className="relative">
                  <Input
                    id="area"
                    type="number"
                    step="any"
                    min="0"
                    disabled={pending}
                    className={cn(isRtl ? "pl-12" : "pr-12")}
                    {...register("area")}
                  />
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-y-0 flex items-center text-xs font-medium text-muted-foreground",
                      isRtl ? "left-3" : "right-3"
                    )}
                  >
                    m²
                  </span>
                </div>
              ) : (
                <p className="text-sm">
                  {defaults.area != null ? `${defaults.area} m²` : "—"}
                </p>
              )}
            </div>
            {!canEditClient ? (
              <p className="text-sm sm:pt-7">
                <strong>{t("agent")}:</strong> {defaults.agentLabel}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {!hideClientContact ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {tClient("address1")} / {tClient("address2")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="address1">{tClient("address1")}</Label>
              <Input
                id="address1"
                disabled={!canEditClient || pending}
                {...register("address1")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address2">{tClient("address2")}</Label>
              <Input
                id="address2"
                disabled={!canEditClient || pending}
                {...register("address2")}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("type")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  disabled={!canEditAdmin || pending}
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
              disabled={!canEditAdmin || pending}
              placeholder="2028"
              {...register("deliveryYear")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gracePeriod">{tUnit("gracePeriod")}</Label>
            <Input
              id="gracePeriod"
              disabled={!canEditAdmin || pending}
              {...register("gracePeriod")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractPricePerMeter">
              {tUnit("contractPricePerMeter")}
            </Label>
            <div className="relative">
              <Input
                id="contractPricePerMeter"
                type="number"
                step="any"
                min="0"
                disabled={!canEditAdmin || pending}
                className={cn(isRtl ? "pl-14" : "pr-14")}
                {...register("contractPricePerMeter")}
              />
              <span
                className={cn(
                  "pointer-events-none absolute inset-y-0 flex items-center text-xs font-medium text-muted-foreground",
                  isRtl ? "left-3" : "right-3"
                )}
              >
                {currencyLabel}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {canEditClient ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {canEditAdmin ? (
            <>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => setDeleteOpen(true)}
              >
                {t("deleteUnit")}
              </Button>
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("deleteUnitTitle")}</DialogTitle>
                    <DialogDescription>
                      {t("deleteUnitConfirm", {
                        unitCode: defaults.unitCode,
                        project: defaults.projectName,
                      })}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDeleteOpen(false)}
                    >
                      {tCommon("cancel")}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={pending}
                      onClick={onConfirmDelete}
                    >
                      {t("deleteUnitAction")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={pending} className="sm:ms-auto">
            {tCommon("save")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
