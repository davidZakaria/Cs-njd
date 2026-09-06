"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { assignEngineerAction } from "@/lib/actions/engineering";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function EngineerSelect({
  engineerId,
  engineerName,
  engineers,
  unassignedLabel,
}: {
  engineerId: string | null;
  engineerName: string | null;
  engineers: Array<{ id: string; name: string }>;
  unassignedLabel: string;
}) {
  const labels = useDomainLabels();
  const formatStaffName = labels.staffName;
  const items = useMemo(() => {
    const map: Record<string, string> = { unassigned: unassignedLabel };
    for (const engineer of engineers) {
      map[engineer.id] = formatStaffName(engineer.name);
    }
    if (engineerId && engineerName && !map[engineerId]) {
      map[engineerId] = formatStaffName(engineerName);
    }
    return map;
  }, [engineerId, engineerName, engineers, formatStaffName, unassignedLabel]);

  const resolved = engineerId && items[engineerId] ? engineerId : "unassigned";
  const [value, setValue] = useState(resolved);

  return (
    <>
      <input type="hidden" name="engineerId" value={value} />
      <Select
        value={value}
        onValueChange={(next) => {
          if (next != null) setValue(next);
        }}
        items={items}
      >
        <SelectTrigger className="w-full sm:w-[14rem]">
          <SelectValue placeholder={unassignedLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">{unassignedLabel}</SelectItem>
          {engineers.map((engineer) => (
            <SelectItem key={engineer.id} value={engineer.id}>
              {formatStaffName(engineer.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

export function AssignEngineerSelect({
  unitId,
  engineerId,
  engineerName,
  engineers,
  canEdit,
}: {
  unitId: string;
  engineerId: string | null;
  engineerName: string | null;
  engineers: Array<{ id: string; name: string }>;
  canEdit: boolean;
}) {
  const t = useTranslations("engineering");
  const tCommon = useTranslations("common");
  const labels = useDomainLabels();
  const { pending, notify } = useCrudToast();

  async function handleAssign(formData: FormData) {
    notify(await assignEngineerAction(formData), "assigned");
  }

  const displayName = engineerId && engineerName
    ? labels.staffName(engineerName)
    : t("unassignedEngineer");

  if (!canEdit) {
    return (
      <p className="text-sm">
        <span className="text-muted-foreground">{t("assignEngineer")}: </span>
        <span className="font-medium">{displayName}</span>
      </p>
    );
  }

  return (
    <form
      action={handleAssign}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <input type="hidden" name="unitId" value={unitId} />
      <p className="text-sm font-medium">{t("assignEngineer")}</p>
      <EngineerSelect
        key={`${unitId}-${engineerId ?? "unassigned"}`}
        engineerId={engineerId}
        engineerName={engineerName}
        engineers={engineers}
        unassignedLabel={t("unassignedEngineer")}
      />
      <Button type="submit" size="sm" disabled={pending}>
        {tCommon("save")}
      </Button>
    </form>
  );
}
