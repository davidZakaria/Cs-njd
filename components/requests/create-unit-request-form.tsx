"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { ArchiveFileKind, ArchiveFileRequestPriority, UnitRequestType } from "@prisma/client";

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
const ARCHIVE_FILE_KINDS = Object.values(ArchiveFileKind);

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
  const [archiveFileKinds, setArchiveFileKinds] = useState<ArchiveFileKind[]>([]);
  const [archiveFilePriority, setArchiveFilePriority] =
    useState<ArchiveFileRequestPriority>("NORMAL");

  const requestTypeItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const value of TYPES) {
      items[value] = tEnums(`unitRequestType.${value}`);
    }
    return items;
  }, [tEnums]);

  const requestTypeLabel = requestTypeItems[type] ?? type;

  const archiveScopeItems = useMemo(
    () => ({
      single: t("archiveScopeSingle"),
      bulk: t("archiveScopeBulk"),
    }),
    [t]
  );

  const projectItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const project of projects) {
      items[project.id] = project.name;
    }
    return items;
  }, [projects]);

  const projectLabel = projectItems[projectId] ?? "";

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

  const handleUnitChange = useCallback((unit: UnitRequestPickerOption | null) => {
    setSelectedUnit(unit);
    setSelectedSwapTarget(null);
  }, []);

  const canSubmit =
    type === UnitRequestType.ARCHIVE_CHECK && archiveScope === "bulk"
      ? projectId.length > 0
      : type === UnitRequestType.ARCHIVE_FILE_REQUEST
        ? selectedUnit != null && archiveFileKinds.length > 0
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
        if (result.skippedUnitCount > 0) {
          toast.success(
            t("createdBulkWithSkipped", {
              included: result.includedUnitCount,
              skipped: result.skippedUnitCount,
            })
          );
        } else {
          toast.success(t("created"));
        }
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
    if (type === UnitRequestType.ARCHIVE_FILE_REQUEST && archiveFileKinds.length === 0) {
      toast.error(t("archiveFileKindsRequired"));
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
        archiveFileKinds:
          type === UnitRequestType.ARCHIVE_FILE_REQUEST ? archiveFileKinds : undefined,
        archiveFilePriority:
          type === UnitRequestType.ARCHIVE_FILE_REQUEST
            ? archiveFilePriority
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
              items={archiveScopeItems}
              onValueChange={(value) =>
                setArchiveScope(value === "bulk" ? "bulk" : "single")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>{archiveScopeItems[archiveScope]}</SelectValue>
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
            <Select
              value={projectId}
              items={projectItems}
              onValueChange={(value) => setProjectId(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("projectPlaceholder")}>
                  {projectLabel}
                </SelectValue>
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
            onChange={handleUnitChange}
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
        {type === UnitRequestType.ARCHIVE_FILE_REQUEST ? (
          <>
            <div className="md:col-span-2 space-y-2">
              <p className="text-sm font-medium">{t("archiveFileKinds")}</p>
              <div className="flex flex-wrap gap-3">
                {ARCHIVE_FILE_KINDS.map((kind) => {
                  const checked = archiveFileKinds.includes(kind);
                  return (
                    <label key={kind} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={pending}
                        onChange={() => {
                          setArchiveFileKinds((prev) =>
                            checked
                              ? prev.filter((k) => k !== kind)
                              : [...prev, kind]
                          );
                        }}
                      />
                      {tEnums(`archiveFileKind.${kind}`)}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("archiveFilePriority")}</label>
              <Select
                value={archiveFilePriority}
                items={{
                  NORMAL: tEnums("archiveFileRequestPriority.NORMAL"),
                  URGENT: tEnums("archiveFileRequestPriority.URGENT"),
                }}
                onValueChange={(v) =>
                  setArchiveFilePriority(v as ArchiveFileRequestPriority)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {tEnums(`archiveFileRequestPriority.${archiveFilePriority}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">
                    {tEnums("archiveFileRequestPriority.NORMAL")}
                  </SelectItem>
                  <SelectItem value="URGENT">
                    {tEnums("archiveFileRequestPriority.URGENT")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
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
