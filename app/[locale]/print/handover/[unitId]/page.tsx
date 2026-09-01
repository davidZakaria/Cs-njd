import { auth } from "@/lib/auth";
import {
  canAccessUnitAsCsAgent,
  resolveCsAgentScope,
} from "@/lib/auth/cs-agent-scope";
import { prisma } from "@/lib/prisma";
import { getCompanyProfileSettings } from "@/lib/system/settings-store";
import { HandoverProtocolDocument } from "@/components/print/handover-protocol-document";
import { PrintOnLoad } from "@/components/print/print-on-load";
import { buildHandoverFields } from "@/lib/print/handover-templates/fields";
import {
  loadHandoverTemplate,
  parseHandoverSearchParams,
  resolveHandoverTemplateKey,
} from "@/lib/print/handover-templates/resolve";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

export default async function HandoverPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; unitId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, unitId } = await params;
  const query = await searchParams;
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

  const companyProfile = await getCompanyProfileSettings();
  const issuedAt = new Date();
  const templateOptions = parseHandoverSearchParams(query);
  const templateKey = resolveHandoverTemplateKey(unit.project.name, templateOptions);
  const template = loadHandoverTemplate(templateKey);

  const hideClientContact = session.user.role === "CS_AGENT";
  const fields = buildHandoverFields(
    {
      ...unit,
      client: hideClientContact ? null : unit.client,
    },
    locale,
    issuedAt
  );

  const documentData = {
    templateKey,
    template,
    fields,
    companyName: companyProfile.name,
    companyAddress: companyProfile.address,
    locale,
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
