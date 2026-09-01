import { auth } from "@/lib/auth";
import {
  canAccessUnitAsCsAgent,
  resolveCsAgentScope,
} from "@/lib/auth/cs-agent-scope";
import { prisma, notDeleted } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UnitTimelineCrud } from "@/components/units/unit-timeline-crud";
import { HandoverChecklistForm } from "@/components/units/handover-checklist-form";
import { UnitFinishingForm } from "@/components/units/unit-finishing-form";
import { UnitClientForm } from "@/components/units/unit-client-form";
import { PrintProtocolButton } from "@/components/units/print-protocol-button";
import { CsAgentPreviewBanner } from "@/components/layout/cs-agent-preview-banner";
import { isAwaitingResponseNote } from "@/lib/import/master-cases";
import { getDomainLabels } from "@/lib/i18n/domain-labels";
import { getWhatsAppTemplateSetting } from "@/lib/system/settings-store";
import { canUseManagementOverride } from "@/lib/workflow/management-override";
import { canManageUnitTickets } from "@/lib/auth/unit-ticket-access";

export default async function UnitProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id, locale } = await params;
  const { tab } = await searchParams;
  const session = await auth();
  const t = await getTranslations("units");
  const tCases = await getTranslations("cases");
  const labels = await getDomainLabels(locale);
  const waMessageTemplate = await getWhatsAppTemplateSetting();

  const statusItems: Record<string, string> = {
    PENDING: await labels.ticketStatus("PENDING"),
    ENGINEERING: await labels.ticketStatus("ENGINEERING"),
    LEGAL: await labels.ticketStatus("LEGAL"),
    RESOLVED: await labels.ticketStatus("RESOLVED"),
  };

  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      project: true,
      client: true,
      agent: true,
      contractWorkflow: true,
      finishing: true,
      tickets: {
        where: notDeleted,
        include: { agent: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!unit) notFound();

  const csScope =
    session?.user.role === "CS_AGENT"
      ? await resolveCsAgentScope(session.user)
      : null;

  if (csScope && !canAccessUnitAsCsAgent(csScope, unit.agentId)) {
    redirect("/units");
  }

  const projectLabel = await labels.project(unit.project.name);
  const areaLabel = await labels.areaWithUnit(unit.area);
  const agentLabel = unit.agent
    ? await labels.staffName(unit.agent.name)
    : labels.unassigned;
  const handoverLabel = await labels.handoverStatus(
    unit.contractWorkflow?.handoverStatus ?? "PENDING"
  );
  const finishingLabel = unit.finishing?.packageType
    ? await labels.finishingPackage(unit.finishing.packageType)
    : unit.finishing?.packageLabel
      ? unit.finishing.packageLabel
      : unit.finishing?.finishingType
        ? await labels.finishingType(unit.finishing.finishingType)
        : "-";
  const companyLabel = unit.finishing?.executingCompany
    ? await labels.executingCompany(unit.finishing.executingCompany)
    : unit.finishing?.companyName ?? "-";
  const canEditProfile =
    session?.user.role === "SUPER_ADMIN" ||
    session?.user.role === "MANAGEMENT";
  const hideClientContact = session?.user.role === "CS_AGENT";

  const canManageTickets = session?.user
    ? canManageUnitTickets(session.user)
    : false;

  return (
    <div className="space-y-6">
      {csScope?.isPreview && csScope.previewSourceEmail ? (
        <CsAgentPreviewBanner previewSourceEmail={csScope.previewSourceEmail} />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("profile")}</h1>
          <p className="text-muted-foreground">
            {projectLabel} · {unit.unitCode}
          </p>
        </div>
        <PrintProtocolButton unitId={unit.id} locale={locale} projectName={unit.project.name} />
      </div>

      <Tabs defaultValue={tab === "timeline" ? "timeline" : "client"}>
        <TabsList>
          <TabsTrigger value="client">{t("clientInfo")}</TabsTrigger>
          <TabsTrigger value="financials">{t("financials")}</TabsTrigger>
          <TabsTrigger value="legal">{t("legalStatus")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("timeline")}</TabsTrigger>
        </TabsList>

        <TabsContent value="client">
          <UnitClientForm
            canEdit={canEditProfile}
            hideClientContact={hideClientContact}
            defaults={{
              unitId: unit.id,
              clientName: unit.client?.name ?? "—",
              phone1: hideClientContact ? null : unit.client?.phone1 ?? null,
              phone2: hideClientContact ? null : unit.client?.phone2 ?? null,
              email: hideClientContact ? null : unit.client?.email ?? null,
              address1: hideClientContact ? null : unit.client?.address1 ?? null,
              address2: hideClientContact ? null : unit.client?.address2 ?? null,
              deliveryYear: unit.deliveryYear ?? null,
              gracePeriod: unit.gracePeriod ?? null,
              contractPricePerMeter: unit.contractPricePerMeter ?? null,
              type: unit.type,
              unitCode: unit.unitCode,
              projectName: projectLabel,
              agentLabel,
              areaLabel,
              waMessageTemplate,
            }}
          />
        </TabsContent>

        <TabsContent value="financials">
          <UnitFinishingForm
            defaults={{
              unitId: unit.id,
              packageType: unit.finishing?.packageType ?? null,
              executingCompany: unit.finishing?.executingCompany ?? null,
              contractDate: unit.finishing?.contractDate?.toISOString() ?? null,
              datedAt: unit.finishing?.datedAt?.toISOString() ?? null,
              deliveryDate: unit.contractWorkflow?.deliveryDate?.toISOString() ?? null,
              emailDate: unit.finishing?.emailDate?.toISOString() ?? null,
              pricePerMeter: unit.finishing?.pricePerMeter ?? null,
              totalFinishingPrice: unit.finishing?.totalFinishingPrice ?? null,
              doorFees: unit.finishing?.doorFees ?? null,
              aluminumFees: unit.finishing?.aluminumFees ?? null,
              phases:
                unit.finishing?.phases?.length
                  ? unit.finishing.phases
                  : unit.finishing?.phase
                    ? [unit.finishing.phase]
                    : [],
              currentFinishingStatus: unit.finishing?.currentFinishingStatus ?? null,
              packageLabel: unit.finishing?.packageLabel ?? null,
              companyName: unit.finishing?.companyName ?? null,
              finishingType: unit.finishing?.finishingType ?? null,
            }}
            canEdit={canEditProfile}
            packageDisplayLabel={finishingLabel}
            companyDisplayLabel={companyLabel}
          />
        </TabsContent>

        <TabsContent value="legal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("legalStatus")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong>{t("handoverStatus")}:</strong>{" "}
                <Badge>{handoverLabel}</Badge>
              </p>
              <p><strong>{t("actionLabel")}:</strong> {unit.contractWorkflow?.actionLabel ?? "-"}</p>
              <p><strong>{t("contractDate")}:</strong> {unit.contractWorkflow?.contractDate?.toLocaleDateString(locale) ?? "-"}</p>
              <p><strong>{t("deliveryDate")}:</strong> {unit.contractWorkflow?.deliveryDate?.toLocaleDateString(locale) ?? "-"}</p>
            </CardContent>
          </Card>
          {canEditProfile ? (
            <HandoverChecklistForm
              canEdit={canEditProfile}
              defaults={{
                unitId: unit.id,
                hasSignedProtocol: unit.contractWorkflow?.hasSignedProtocol ?? false,
                hasSignedExtension: unit.contractWorkflow?.hasSignedExtension ?? false,
                hasPaidFees: unit.contractWorkflow?.hasPaidFees ?? false,
                papersReceived: unit.contractWorkflow?.papersReceived ?? false,
              }}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="timeline">
          <UnitTimelineCrud
            unitId={unit.id}
            tickets={(
              await Promise.all(
                unit.tickets.map(async (ticket) => ({
                  id: ticket.id,
                  notes: ticket.notes,
                  category: ticket.category,
                  categoryLabel: await labels.ticketCategory(ticket.category),
                  status: ticket.status,
                  pendingParty: ticket.pendingParty ?? "NONE",
                  pendingPartyLabel: await labels.pendingParty(
                    ticket.pendingParty ?? "NONE"
                  ),
                  nextFollowUpDate: ticket.nextFollowUpDate?.toISOString() ?? "",
                  statusLabel: await labels.ticketStatus(ticket.status),
                  agentLabel: ticket.agent
                    ? await labels.staffName(ticket.agent.name)
                    : labels.unassigned,
                  createdAtLabel: ticket.createdAt.toLocaleString(locale),
                  displayNotes: isAwaitingResponseNote(ticket.notes)
                    ? tCases("awaitingResponse")
                    : ticket.notes,
                  canEdit:
                    session?.user.role !== "CS_AGENT" ||
                    (csScope
                      ? canAccessUnitAsCsAgent(csScope, unit.agentId)
                      : unit.agentId === session?.user.id),
                }))
              )
            )}
            statusItems={statusItems}
            timelineLabel={t("timeline")}
            noTicketsLabel={t("noTickets")}
            addFeedbackLabel={t("addFeedback")}
            notesPlaceholder={t("notesPlaceholder")}
            canManageTickets={canManageTickets}
            canUseManagementOverride={
              session?.user
                ? canUseManagementOverride(session.user)
                : false
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
