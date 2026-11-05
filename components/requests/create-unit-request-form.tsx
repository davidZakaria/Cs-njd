"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { UnitRequestType } from "@prisma/client";

import {
  createUnitRequestAction,
  resolveUnitForRequestPickerAction,
  searchUnitsForRequestPickerAction,
} from "@/lib/actions/unit-requests";
import { createBulkArchiveCheckAction } from "@/lib/actions/archive-check";
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

export function CreateUnitRequestForm({
  defaultUnitId,
  projects = [],
}: {
  defaultUnitId?: string;
  projects?: Array<{ id: string; name: string }>;
}) {
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
  const [archiveScope, setArchiveScope] = useState<"single" | "bulk">("single");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");

  const requestTypeItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const value of TYPES) {
      items[value] = tEnums(`unitRequestType.${value}`);
    }
    return items;
  }, [tEnums]);

  const requestTypeLabel = requestTypeItems[type] ?? type;

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
    type === UnitRequestType.ARCHIVE_CHECK && archiveScope === "bulk"
      ? projectId.length > 0
      : selectedUnit != null &&
        (type !== UnitRequestType.UNIT_SWAP || selectedSwapTarget != null);

  const submit = () => {
    if (type === UnitRequestType.ARCHIVE_CHECK && archiveScope === "bulk") {
      if (!projectId) {
        toast.error(t("projectRequired"));
        return;
      }
      startTransition(async () => {
        const result = await createBulkArchiveCheckAction({
          projectId,
          description,
        });
        if (!result.success) {
          toast.error(result.error ?? t("failed"));
          return;
        }
        toast.success(t("created"));
        router.push(`/requests/${result.id}`);
      });
      return;
    }

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
        {type === UnitRequestType.ARCHIVE_CHECK ? (
          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium">{t("archiveScope")}</label>
            <Select
              value={archiveScope}
              onValueChange={(value) =>
                setArchiveScope(value === "bulk" ? "bulk" : "single")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">{t("archiveScopeSingle")}</SelectItem>
                <SelectItem value="bulk">{t("archiveScopeBulk")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {type === UnitRequestType.ARCHIVE_CHECK && archiveScope === "bulk" ? (
          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium">{t("project")}</label>
            <Select value={projectId} onValueChange={(value) => setProjectId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("projectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
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
        )}
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("type")}</label>
          <Select
            value={type}
            items={requestTypeItems}
            onValueChange={(v) => setType(v as UnitRequestType)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{requestTypeLabel}</SelectValue>
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
