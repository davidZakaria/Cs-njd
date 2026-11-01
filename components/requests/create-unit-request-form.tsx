"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { UnitRequestType } from "@prisma/client";

import {
  createUnitRequestAction,
  resolveUnitForRequestPickerAction,
  searchUnitsForRequestPickerAction,
} from "@/lib/actions/unit-requests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UnitSearchCombobox } from "@/components/units/unit-search-combobox";
import type { UnitRequestPickerOption } from "@/lib/units/unit-request-search";

const TYPES = Object.values(UnitRequestType);

export function CreateUnitRequestForm({ defaultUnitId }: { defaultUnitId?: string }) {
  const t = useTranslations("requests.create");
  const tEnums = useTranslations("enums");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedUnit, setSelectedUnit] = useState<UnitRequestPickerOption | null>(
    null
  );
  const [selectedSwapTarget, setSelectedSwapTarget] =
    useState<UnitRequestPickerOption | null>(null);
  const [type, setType] = useState<UnitRequestType>(
    UnitRequestType.CONTRACT_ISSUE_OR_AMENDMENT
  );
  const [description, setDescription] = useState("");

  const searchUnits = useCallback(
    (query: string) => searchUnitsForRequestPickerAction(query),
    []
  );

  const searchSwapTargets = useCallback(
    (query: string) =>
      selectedUnit
        ? searchUnitsForRequestPickerAction(query, selectedUnit.unitId)
        : Promise.resolve([]),
    [selectedUnit]
  );

  useEffect(() => {
    setSelectedSwapTarget(null);
  }, [selectedUnit?.unitId]);

  const canSubmit =
    selectedUnit != null &&
    (type !== UnitRequestType.UNIT_SWAP || selectedSwapTarget != null);

  const submit = () => {
    if (!selectedUnit) {
      toast.error(t("unitRequired"));
      return;
    }
    if (type === UnitRequestType.UNIT_SWAP && !selectedSwapTarget) {
      toast.error(t("swapTargetRequired"));
      return;
    }
    startTransition(async () => {
      const result = await createUnitRequestAction({
        unitId: selectedUnit.unitId,
        type,
        description,
        linkedSwapTargetUnitId:
          type === UnitRequestType.UNIT_SWAP
            ? selectedSwapTarget?.unitId
            : undefined,
      });
      if (!result.success) {
        toast.error(result.error ?? t("failed"));
        return;
      }
      toast.success(t("created"));
      router.push(`/requests/${result.id}`);
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <UnitSearchCombobox
          label={t("unit")}
          placeholder={t("unitSearchPlaceholder")}
          emptyHint={t("unitSearchMinChars")}
          value={selectedUnit}
          onChange={setSelectedUnit}
          onSearch={searchUnits}
          onResolveUnit={resolveUnitForRequestPickerAction}
          initialUnitId={defaultUnitId}
          disabled={pending}
        />
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("type")}</label>
          <Select value={type} onValueChange={(v) => setType(v as UnitRequestType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tEnums(`unitRequestType.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="text-sm font-medium">{t("description")}</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        {type === UnitRequestType.UNIT_SWAP ? (
          <div className="md:col-span-2">
            <UnitSearchCombobox
              label={t("swapTargetUnit")}
              placeholder={t("unitSearchPlaceholder")}
              emptyHint={
                selectedUnit ? t("unitSearchMinChars") : t("swapTargetSelectSourceFirst")
              }
              value={selectedSwapTarget}
              onChange={setSelectedSwapTarget}
              onSearch={searchSwapTargets}
              disabled={pending || !selectedUnit}
            />
          </div>
        ) : null}
        <div className="md:col-span-2">
          <Button disabled={pending || !canSubmit} onClick={submit}>
            {t("submit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
