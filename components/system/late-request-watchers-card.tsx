"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Bell, Loader2, UserMinus, UserPlus, X } from "lucide-react";

import { updateSystemSetting } from "@/lib/actions/settings";
import { SYSTEM_SETTING_KEYS } from "@/lib/system/settings-keys";
import {
  parseLateRequestWatchersValue,
  serializeLateRequestWatchersValue,
  type LateRequestWatchersConfig,
} from "@/lib/system/late-request-watchers-config";
import type { Role } from "@prisma/client";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LateRequestWatcherCandidate = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type ListKey = "include" | "exclude";

export function LateRequestWatchersCard({
  initialValue,
  candidates,
}: {
  initialValue: string;
  candidates: LateRequestWatcherCandidate[];
}) {
  const t = useTranslations("generalSettings.lateRequestWatchers");
  const router = useRouter();
  const { pending, runAction } = useCrudToast();
  const [config, setConfig] = useState<LateRequestWatchersConfig>(() =>
    parseLateRequestWatchersValue(initialValue)
  );
  const [pickerTarget, setPickerTarget] = useState<ListKey>("include");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const usedIds = useMemo(
    () => new Set([...config.include, ...config.exclude]),
    [config.include, config.exclude]
  );

  const availableToAdd = useMemo(
    () => candidates.filter((user) => !usedIds.has(user.id)),
    [candidates, usedIds]
  );

  function removeFromList(list: ListKey, userId: string) {
    setConfig((current) => ({
      ...current,
      [list]: current[list].filter((id) => id !== userId),
    }));
  }

  function addToList() {
    if (!selectedUserId) return;
    setConfig((current) => ({
      ...current,
      [pickerTarget]: [...new Set([...current[pickerTarget], selectedUserId])],
      [pickerTarget === "include" ? "exclude" : "include"]: current[
        pickerTarget === "include" ? "exclude" : "include"
      ].filter((id) => id !== selectedUserId),
    }));
    setSelectedUserId("");
  }

  function resolveUser(userId: string) {
    return candidates.find((user) => user.id === userId);
  }

  function renderList(list: ListKey) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          {list === "include" ? t("includeLabel") : t("excludeLabel")}
        </Label>
        <ul className="min-h-10 space-y-2 rounded-lg border bg-muted/20 p-3">
          {config[list].length === 0 ? (
            <li className="text-sm text-muted-foreground">{t("emptyList")}</li>
          ) : (
            config[list].map((userId) => {
              const user = resolveUser(userId);
              return (
                <li
                  key={`${list}-${userId}`}
                  className="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 text-sm [dir=rtl]:flex-row-reverse"
                >
                  <div className="min-w-0 text-start">
                    <p className="truncate font-medium">
                      {user?.name ?? userId}
                    </p>
                    {user ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email} · {user.role}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={() => removeFromList(list, userId)}
                    aria-label={t("removeUser")}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    );
  }

  function handleSave() {
    const payload = serializeLateRequestWatchersValue(config);
    runAction(async () => {
      const result = await updateSystemSetting(
        SYSTEM_SETTING_KEYS.LATE_REQUEST_WATCHERS,
        payload
      );
      if (result.success) {
        router.refresh();
      }
      return result;
    }, "saved", t("savedToast"));
  }

  return (
    <Card className="shadow-premium">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 [dir=rtl]:flex-row-reverse">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Bell className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-start">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-start">
        <p className="text-sm text-muted-foreground">{t("defaultHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{t("defaultManagementBadge")}</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {renderList("include")}
          {renderList("exclude")}
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <Label>{t("addUserLabel")}</Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end [dir=rtl]:sm:flex-row-reverse">
            <Select
              value={pickerTarget}
              onValueChange={(value) => setPickerTarget(value as ListKey)}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t("listTargetPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="include">{t("addToInclude")}</SelectItem>
                <SelectItem value="exclude">{t("addToExclude")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={selectedUserId || undefined}
              onValueChange={setSelectedUserId}
            >
              <SelectTrigger className="w-full sm:max-w-md">
                <SelectValue placeholder={t("userPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="secondary"
              disabled={!selectedUserId || pending}
              onClick={addToList}
              className="gap-2"
            >
              {pickerTarget === "include" ? (
                <UserPlus className="size-4" />
              ) : (
                <UserMinus className="size-4" />
              )}
              {t("addUser")}
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end border-t [dir=rtl]:justify-start">
        <Button type="button" disabled={pending} onClick={handleSave}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("save")}
        </Button>
      </CardFooter>
    </Card>
  );
}