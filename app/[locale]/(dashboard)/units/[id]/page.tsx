import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createTicket, updateTicketStatus } from "@/lib/actions/crm";
import { isAwaitingResponseNote } from "@/lib/import/master-cases";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDomainLabels } from "@/lib/i18n/domain-labels";

const TICKET_STATUSES = ["PENDING", "ENGINEERING", "LEGAL", "RESOLVED"] as const;

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
  const tCommon = await getTranslations("common");
  const labels = await getDomainLabels(locale);

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
        include: { agent: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!unit) notFound();

  if (session?.user.role === "CS_AGENT" && unit.agentId !== session.user.id) {
    redirect("/units");
  }

  const projectLabel = await labels.project(unit.project.name);
  const unitTypeLabel = await labels.unitType(unit.type);
  const areaLabel = await labels.areaWithUnit(unit.area);
  const agentLabel = unit.agent
    ? await labels.staffName(unit.agent.name)
    : labels.unassigned;
  const handoverLabel = await labels.handoverStatus(
    unit.contractWorkflow?.handoverStatus ?? "PENDING"
  );
  const finishingLabel = unit.finishing?.packageLabel
    ?? (unit.finishing?.finishingType
      ? await labels.finishingType(unit.finishing.finishingType)
      : "-");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("profile")}</h1>
        <p className="text-muted-foreground">
          {projectLabel} · {unit.unitCode}
        </p>
      </div>

      <Tabs defaultValue={tab === "timeline" ? "timeline" : "client"}>
        <TabsList>
          <TabsTrigger value="client">{t("clientInfo")}</TabsTrigger>
          <TabsTrigger value="financials">{t("financials")}</TabsTrigger>
          <TabsTrigger value="legal">{t("legalStatus")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("timeline")}</TabsTrigger>
        </TabsList>

        <TabsContent value="client">
          <Card>
            <CardHeader>
              <CardTitle>{t("clientInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>{t("client")}:</strong> {unit.client?.name ?? "-"}</p>
              <p><strong>{t("phone1")}:</strong> {unit.client?.phone1 ?? "-"}</p>
              <p><strong>{t("phone2")}:</strong> {unit.client?.phone2 ?? "-"}</p>
              <p><strong>{tCommon("email")}:</strong> {unit.client?.email ?? "-"}</p>
              <p><strong>{t("type")}:</strong> {unitTypeLabel}</p>
              <p><strong>{t("area")}:</strong> {areaLabel}</p>
              <p><strong>{t("agent")}:</strong> {agentLabel}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials">
          <Card>
            <CardHeader>
              <CardTitle>{t("financials")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>{t("package")}:</strong> {finishingLabel}</p>
              <p><strong>{t("company")}:</strong> {unit.finishing?.companyName ?? "-"}</p>
              <p><strong>{t("pricePerMeter")}:</strong> {unit.finishing?.pricePerMeter ?? "-"}</p>
              <p><strong>{t("totalPrice")}:</strong> {unit.finishing?.totalFinishingPrice ?? "-"}</p>
              <p><strong>{t("doorFees")}:</strong> {unit.finishing?.doorFees ?? "-"}</p>
              <p><strong>{t("aluminumFees")}:</strong> {unit.finishing?.aluminumFees ?? "-"}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legal">
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
        </TabsContent>

        <TabsContent value="timeline">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardHeader>
                <CardTitle>{t("timeline")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {unit.tickets.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("noTickets")}</p>
                )}
                {(
                  await Promise.all(
                    unit.tickets.map(async (ticket) => ({
                      ticket,
                      categoryLabel: await labels.ticketCategory(ticket.category),
                      statusLabel: await labels.ticketStatus(ticket.status),
                      agentLabel: ticket.agent
                        ? await labels.staffName(ticket.agent.name)
                        : labels.unassigned,
                    }))
                  )
                ).map(({ ticket, categoryLabel, statusLabel, agentLabel: ticketAgentLabel }) => (
                  <div key={ticket.id} className="rounded-lg border p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{categoryLabel}</Badge>
                      <Badge variant="outline">{statusLabel}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {ticket.createdAt.toLocaleString(locale)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">
                      {isAwaitingResponseNote(ticket.notes)
                        ? tCases("awaitingResponse")
                        : ticket.notes}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {ticketAgentLabel}
                    </p>
                    {session?.user.role !== "CS_AGENT" || unit.agentId === session.user.id ? (
                      <form action={updateTicketStatus} className="mt-3 flex gap-2">
                        <input type="hidden" name="id" value={ticket.id} />
                        <Select name="status" defaultValue={ticket.status} items={statusItems}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TICKET_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {statusItems[status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="submit" size="sm">{tCommon("update")}</Button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("addFeedback")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={createTicket} className="space-y-3">
                  <input type="hidden" name="unitId" value={unit.id} />
                  <Textarea name="notes" placeholder={t("notesPlaceholder")} required />
                  <Select name="status" defaultValue="PENDING" items={statusItems}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusItems[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit" className="w-full">{tCommon("save")}</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
