"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Building2, Megaphone, MessageCircle, Loader2 } from "lucide-react";

import { updateSystemSetting } from "@/lib/actions/settings";
import { SYSTEM_SETTING_KEYS } from "@/lib/system/settings-keys";
import type { GeneralSettingKey } from "@/lib/system/settings-helpers";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type GeneralSettingsState = Record<GeneralSettingKey, string>;

function toBool(value: string): boolean {
  return value === "true";
}

function fromBool(value: boolean): string {
  return value ? "true" : "false";
}

export function GeneralSettingsPanel({
  initialSettings,
}: {
  initialSettings: GeneralSettingsState;
}) {
  const t = useTranslations("generalSettings");
  const router = useRouter();
  const { pending, runAction } = useCrudToast();
  const [settings, setSettings] = useState(initialSettings);
  const [savingCard, setSavingCard] = useState<
    "announcement" | "whatsapp" | "company" | null
  >(null);

  function updateField(key: GeneralSettingKey, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function handleToggleAnnouncement(enabled: boolean) {
    const value = fromBool(enabled);
    updateField(SYSTEM_SETTING_KEYS.ANNOUNCEMENT_ENABLED, value);
    runAction(
      () => updateSystemSetting(SYSTEM_SETTING_KEYS.ANNOUNCEMENT_ENABLED, value),
      "saved",
      enabled ? t("announcementEnabledToast") : t("announcementDisabledToast")
    );
  }

  function handleSaveFields(
    card: "announcement" | "whatsapp" | "company",
    keys: GeneralSettingKey[]
  ) {
    setSavingCard(card);
    runAction(async () => {
      for (const key of keys) {
        const result = await updateSystemSetting(key, settings[key]);
        if (!result.success) {
          setSavingCard(null);
          return result;
        }
      }
      router.refresh();
      setSavingCard(null);
      return { success: true as const, message: t("savedToast") };
    });
  }

  const announcementEnabled = toBool(settings.ANNOUNCEMENT_ENABLED);

  return (
    <div className="space-y-8">
      <div className="space-y-1 text-start">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid max-w-3xl gap-6">
        <Card className="shadow-premium">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 [dir=rtl]:flex-row-reverse">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Megaphone className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-start">
              <CardTitle>{t("announcement.title")}</CardTitle>
              <CardDescription>{t("announcement.description")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 p-4 [dir=rtl]:flex-row-reverse">
              <div className="space-y-0.5 text-start">
                <Label htmlFor="announcement-enabled" className="text-sm font-medium">
                  {t("announcement.enableLabel")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("announcement.enableHint")}
                </p>
              </div>
              <Switch
                id="announcement-enabled"
                checked={announcementEnabled}
                disabled={pending}
                onCheckedChange={handleToggleAnnouncement}
              />
            </div>

            <div className="space-y-2 text-start">
              <Label htmlFor="announcement-text">{t("announcement.textLabel")}</Label>
              <Textarea
                id="announcement-text"
                value={settings.ANNOUNCEMENT_TEXT}
                onChange={(e) =>
                  updateField(SYSTEM_SETTING_KEYS.ANNOUNCEMENT_TEXT, e.target.value)
                }
                rows={4}
                disabled={pending}
                placeholder={t("announcement.textPlaceholder")}
                className="min-h-24 resize-y text-start"
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t bg-muted/10 [dir=rtl]:justify-start">
            <Button
              type="button"
              disabled={pending || savingCard === "announcement"}
              onClick={() =>
                handleSaveFields("announcement", [
                  SYSTEM_SETTING_KEYS.ANNOUNCEMENT_TEXT,
                ])
              }
            >
              {savingCard === "announcement" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("saveAnnouncement")
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-premium">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 [dir=rtl]:flex-row-reverse">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-start">
              <CardTitle>{t("whatsapp.title")}</CardTitle>
              <CardDescription>{t("whatsapp.description")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-start">
            <Label htmlFor="wa-template">{t("whatsapp.templateLabel")}</Label>
            <Textarea
              id="wa-template"
              value={settings.WA_TEMPLATE}
              onChange={(e) =>
                updateField(SYSTEM_SETTING_KEYS.WA_TEMPLATE, e.target.value)
              }
              rows={5}
              disabled={pending}
              className="min-h-28 resize-y font-mono text-sm text-start"
            />
            <p className="text-xs text-muted-foreground">{t("whatsapp.variablesHint")}</p>
          </CardContent>
          <CardFooter className="justify-end border-t bg-muted/10 [dir=rtl]:justify-start">
            <Button
              type="button"
              disabled={pending || savingCard === "whatsapp"}
              onClick={() =>
                handleSaveFields("whatsapp", [SYSTEM_SETTING_KEYS.WA_TEMPLATE])
              }
            >
              {savingCard === "whatsapp" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("saveWhatsapp")
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-premium">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 [dir=rtl]:flex-row-reverse">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-start">
              <CardTitle>{t("company.title")}</CardTitle>
              <CardDescription>{t("company.description")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-start">
            <div className="space-y-2">
              <Label htmlFor="company-name">{t("company.nameLabel")}</Label>
              <Input
                id="company-name"
                value={settings.COMPANY_NAME}
                onChange={(e) =>
                  updateField(SYSTEM_SETTING_KEYS.COMPANY_NAME, e.target.value)
                }
                disabled={pending}
                className="text-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-address">{t("company.addressLabel")}</Label>
              <Input
                id="company-address"
                value={settings.COMPANY_ADDRESS}
                onChange={(e) =>
                  updateField(SYSTEM_SETTING_KEYS.COMPANY_ADDRESS, e.target.value)
                }
                disabled={pending}
                className="text-start"
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t bg-muted/10 [dir=rtl]:justify-start">
            <Button
              type="button"
              disabled={pending || savingCard === "company"}
              onClick={() =>
                handleSaveFields("company", [
                  SYSTEM_SETTING_KEYS.COMPANY_NAME,
                  SYSTEM_SETTING_KEYS.COMPANY_ADDRESS,
                ])
              }
            >
              {savingCard === "company" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("saveCompany")
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
