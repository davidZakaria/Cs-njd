import { auth } from "@/lib/auth";
import {
  canAccessUnitAsCsAgent,
  resolveCsAgentScope,
} from "@/lib/auth/cs-agent-scope";
import { prisma } from "@/lib/prisma";
import { getDomainLabels } from "@/lib/i18n/domain-labels";
import { getCompanyProfileSettings } from "@/lib/system/settings-store";
import { HandoverProtocolDocument } from "@/components/print/handover-protocol-document";
import { PrintOnLoad } from "@/components/print/print-on-load";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

function formatPrintDate(date: Date | null | undefined, locale: string) {
  if (!date) return null;
  return date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function HandoverPrintPage({
  params,
}: {
  params: Promise<{ locale: string; unitId: string }>;
}) {
  const { locale, unitId } = await params;
  const session = await auth();
  const t = await getTranslations("print.handover");

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      project: true,
      client: true,
      contractWorkflow: true,
      finishing: true,
    },
  });

  if (!unit) notFound();

  const csScope =
    session.user.role === "CS_AGENT"
      ? await resolveCsAgentScope(session.user)
      : null;

  if (csScope && !canAccessUnitAsCsAgent(csScope, unit.agentId)) {
    redirect(`/${locale}/units`);
  }

  const labels = await getDomainLabels(locale);
  const companyProfile = await getCompanyProfileSettings();
  const issuedAt = new Date().toLocaleDateString(
    locale === "ar" ? "ar-EG" : "en-GB",
    { day: "numeric", month: "long", year: "numeric" }
  );

  const finishingPackage = unit.finishing?.packageType
    ? await labels.finishingPackage(unit.finishing.packageType)
    : unit.finishing?.packageLabel ??
      (unit.finishing?.finishingType
        ? await labels.finishingType(unit.finishing.finishingType)
        : null);

  const executingCompany = unit.finishing?.executingCompany
    ? await labels.executingCompany(unit.finishing.executingCompany)
    : unit.finishing?.companyName ?? null;

  const hideClientContact = session.user.role === "CS_AGENT";

  const documentData = {
    locale,
    unitCode: unit.unitCode,
    projectName: await labels.project(unit.project.name),
    unitType: await labels.unitType(unit.type),
    areaLabel: await labels.areaWithUnit(unit.area),
    clientName: unit.client?.name ?? "—",
    clientNationalId: hideClientContact ? null : unit.client?.nationalId ?? null,
    clientPhone1: hideClientContact ? null : unit.client?.phone1 ?? null,
    clientPhone2: hideClientContact ? null : unit.client?.phone2 ?? null,
    clientEmail: hideClientContact ? null : unit.client?.email ?? null,
    handoverStatus: await labels.handoverStatus(
      unit.contractWorkflow?.handoverStatus ?? "PENDING"
    ),
    contractDate: formatPrintDate(unit.contractWorkflow?.contractDate, locale),
    deliveryDate: formatPrintDate(unit.contractWorkflow?.deliveryDate, locale),
    finishingPackage,
    executingCompany,
    totalFinishingPrice: unit.finishing?.totalFinishingPrice ?? null,
    issuedAt,
    companyOfficialName: companyProfile.name,
    companyOfficialAddress: companyProfile.address,
    labels: {
      companyName: t("companyName"),
      documentTitle: t("documentTitle"),
      documentSubtitle: t("documentSubtitle"),
      issuedDate: t("issuedDate"),
      sectionClient: t("sectionClient"),
      sectionUnit: t("sectionUnit"),
      sectionFinishing: t("sectionFinishing"),
      sectionLegal: t("sectionLegal"),
      clientName: t("clientName"),
      nationalId: t("nationalId"),
      phone: t("phone"),
      email: t("email"),
      unitCode: t("unitCode"),
      project: t("project"),
      unitType: t("unitType"),
      area: t("area"),
      handoverStatus: t("handoverStatus"),
      contractDate: t("contractDate"),
      deliveryDate: t("deliveryDate"),
      finishingPackage: t("finishingPackage"),
      executingCompany: t("executingCompany"),
      totalFinishing: t("totalFinishing"),
      bodyIntro: t("bodyIntro", {
        clientName: unit.client?.name ?? "—",
        unitCode: unit.unitCode,
        projectName: await labels.project(unit.project.name),
      }),
      bodyClause1: t("bodyClause1"),
      bodyClause2: t("bodyClause2"),
      bodyClause3: t("bodyClause3"),
      signatureClient: t("signatureClient"),
      signatureCompany: t("signatureCompany"),
      signatureDate: t("signatureDate"),
      footerNote: t("footerNote"),
    },
  };

  return (
    <>
      <PrintOnLoad />
      <div className="print:hidden flex justify-center bg-slate-100 p-4">
        <p className="text-sm text-muted-foreground">{t("printHint")}</p>
      </div>
      <HandoverProtocolDocument data={documentData} />
    </>
  );
}
