"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import type { OfficialDocumentType } from "@prisma/client";

import { saveOfficialDocumentTemplateVersionAction } from "@/lib/actions/official-documents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OFFICIAL_DOCUMENT_TYPES } from "@/lib/official-documents/types";
import { MERGE_FIELD_KEYS } from "@/lib/official-documents/merge-field-keys";

type VersionRow = {
  version: number;
  title: string;
  body: string;
  isActive: boolean;
  createdAt: Date;
  createdBy: { name: string } | null;
};

export function OfficialDocumentTemplatesEditor({
  versionsByKey,
}: {
  versionsByKey: Record<string, VersionRow[]>;
}) {
  const t = useTranslations("officialDocuments.templates");
  const tEnums = useTranslations("enums");
  const locale = useLocale();
  const [documentType, setDocumentType] =
    useState<OfficialDocumentType>("GRACE_PERIOD_ANNEX");
  const [templateLocale, setTemplateLocale] = useState<"en" | "ar">(
    locale === "ar" ? "ar" : "en"
  );

  const key = `${documentType}:${templateLocale}`;
  const versions = versionsByKey[key] ?? [];
  const active = versions.find((v) => v.isActive) ?? versions[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <TemplateEditorForm
        key={key}
        documentType={documentType}
        templateLocale={templateLocale}
        initialTitle={active?.title ?? ""}
        initialBody={active?.body ?? ""}
        onDocumentTypeChange={setDocumentType}
        onLocaleChange={setTemplateLocale}
        t={t}
        tEnums={tEnums}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("mergeFields")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="max-h-[420px] space-y-1 overflow-y-auto font-mono text-xs">
            {MERGE_FIELD_KEYS.map((field) => (
              <li key={field}>{`{{${field}}}`}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{t("versionHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noVersions")}</p>
          ) : (
            <ul className="divide-y divide-border/50 text-sm">
              {versions.map((v) => (
                <li key={v.version} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    v{v.version} — {v.title}
                    {v.isActive ? ` (${t("active")})` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {v.createdBy?.name ?? "—"} ·{" "}
                    {v.createdAt.toLocaleDateString(templateLocale === "ar" ? "ar-EG" : "en-GB")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateEditorForm({
  documentType,
  templateLocale,
  initialTitle,
  initialBody,
  onDocumentTypeChange,
  onLocaleChange,
  t,
  tEnums,
}: {
  documentType: OfficialDocumentType;
  templateLocale: "en" | "ar";
  initialTitle: string;
  initialBody: string;
  onDocumentTypeChange: (v: OfficialDocumentType) => void;
  onLocaleChange: (v: "en" | "ar") => void;
  t: ReturnType<typeof useTranslations>;
  tEnums: ReturnType<typeof useTranslations>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);

  const save = () => {
    startTransition(async () => {
      const result = await saveOfficialDocumentTemplateVersionAction({
        documentType,
        locale: templateLocale,
        title,
        body,
      });
      if (!result.success) {
        toast.error(result.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("saveSuccess"));
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("editorTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("documentType")}</Label>
            <Select
              value={documentType}
              onValueChange={(v) => onDocumentTypeChange(v as OfficialDocumentType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OFFICIAL_DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {tEnums(`officialDocumentType.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("templateLocale")}</Label>
            <Select
              value={templateLocale}
              onValueChange={(v) => onLocaleChange(v as "en" | "ar")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("localeEn")}</SelectItem>
                <SelectItem value="ar">{t("localeAr")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-title">{t("titleField")}</Label>
          <Input
            id="tpl-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            dir={templateLocale === "ar" ? "rtl" : "ltr"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-body">{t("bodyField")}</Label>
          <Textarea
            id="tpl-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            className="font-mono text-sm"
            dir={templateLocale === "ar" ? "rtl" : "ltr"}
          />
        </div>
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? t("saving") : t("saveNewVersion")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("versioningHint")}</p>
      </CardContent>
    </Card>
  );
}
