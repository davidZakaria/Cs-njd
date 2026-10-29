import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { OfficialDocumentTemplatesEditor } from "@/components/official-documents/document-templates-editor";
import { canEditOfficialDocumentTemplates } from "@/lib/official-documents/permissions";
import { OFFICIAL_DOCUMENT_TYPES } from "@/lib/official-documents/types";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";

export const dynamic = "force-dynamic";

export default async function ExecutiveDocumentTemplatesPage() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations("officialDocuments.templates");

  if (!session?.user || !canEditOfficialDocumentTemplates(session.user.role)) {
    redirect(`/${locale}/dashboard`);
  }

  const allVersions = await prisma.officialDocumentTemplate.findMany({
    orderBy: [{ documentType: "asc" }, { locale: "asc" }, { version: "desc" }],
    include: { createdBy: { select: { name: true } } },
  });

  const versionsByKey: Record<
    string,
    {
      version: number;
      title: string;
      body: string;
      isActive: boolean;
      createdAt: Date;
      createdBy: { name: string } | null;
    }[]
  > = {};

  for (const type of OFFICIAL_DOCUMENT_TYPES) {
    for (const loc of ["en", "ar"] as const) {
      const key = `${type}:${loc}`;
      versionsByKey[key] = allVersions
        .filter((v) => v.documentType === type && v.locale === loc)
        .map((v) => ({
          version: v.version,
          title: v.title,
          body: v.body,
          isActive: v.isActive,
          createdAt: v.createdAt,
          createdBy: v.createdBy,
        }));
    }
  }

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-gradient-to-br from-muted/30 via-background to-background p-6 shadow-sm ring-1 ring-foreground/5",
          entranceAnimationClass
        )}
      >
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            {t("pageTitle")}
          </h1>
          <p className="max-w-2xl text-muted-foreground">{t("pageSubtitle")}</p>
        </div>
        <Link
          href="/executive/project-settings"
          className={buttonVariants({ variant: "outline" })}
        >
          {t("backToProjectSettings")}
        </Link>
      </div>
      <OfficialDocumentTemplatesEditor versionsByKey={versionsByKey} />
    </div>
  );
}
