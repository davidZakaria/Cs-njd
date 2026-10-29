"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { UnitRequestType } from "@prisma/client";

import { createUnitRequestAction } from "@/lib/actions/unit-requests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPES = Object.values(UnitRequestType);

export function CreateUnitRequestForm({ defaultUnitId }: { defaultUnitId?: string }) {
  const t = useTranslations("requests.create");
  const tEnums = useTranslations("enums");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [unitId, setUnitId] = useState(defaultUnitId ?? "");
  const [type, setType] = useState<UnitRequestType>(
    UnitRequestType.CONTRACT_ISSUE_OR_AMENDMENT
  );
  const [description, setDescription] = useState("");
  const [swapTargetUnitId, setSwapTargetUnitId] = useState("");

  const submit = () => {
    startTransition(async () => {
      const result = await createUnitRequestAction({
        unitId: unitId.trim(),
        type,
        description,
        linkedSwapTargetUnitId:
          type === UnitRequestType.UNIT_SWAP ? swapTargetUnitId.trim() : undefined,
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
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("unitId")}</label>
          <Input value={unitId} onChange={(e) => setUnitId(e.target.value)} />
        </div>
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
          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium">{t("swapTargetUnitId")}</label>
            <Input
              value={swapTargetUnitId}
              onChange={(e) => setSwapTargetUnitId(e.target.value)}
            />
          </div>
        ) : null}
        <div className="md:col-span-2">
          <Button disabled={pending || !unitId.trim()} onClick={submit}>
            {t("submit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
