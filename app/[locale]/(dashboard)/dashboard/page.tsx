import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { getPendingWorkForSession } from "@/lib/cases/pending-work";
import { PendingWorkQueue } from "@/components/cases/pending-work-queue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  entranceAnimationClass,
  premiumCardHoverClass,
  staggerEntranceClass,
} from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const locale = await getLocale();

  if (session?.user.role === "MANAGEMENT") {
    redirect(`/${locale}/executive`);
  }

  const t = await getTranslations("dashboard");

  const where =
    session?.user.role === "CS_AGENT"
      ? { agentId: session.user.id }
      : {};

  const [totalUnits, pendingTickets, deliveredUnits, legalDisputes, pendingWork] =
    await Promise.all([
      prisma.unit.count({ where }),
      prisma.ticket.count({
        where: {
          status: "PENDING",
          unit: where.agentId ? { agentId: where.agentId } : undefined,
        },
      }),
      prisma.contractWorkflow.count({
        where: {
          handoverStatus: { in: ["DELIVERY_PROTOCOL", "DELIVERED"] },
          unit: where.agentId ? { agentId: where.agentId } : undefined,
        },
      }),
      prisma.contractWorkflow.count({
        where: {
          handoverStatus: {
            in: [
              "REFUSED_DELIVERY",
              "REFUSED_EXTENSION",
              "INSTALLMENT_STOP_WARNING",
              "DELIVERY_WARNING",
              "LEGAL_DISPUTE",
            ],
          },
          unit: where.agentId ? { agentId: where.agentId } : undefined,
        },
      }),
      session?.user
        ? getPendingWorkForSession({
            id: session.user.id,
            role: session.user.role,
          })
        : Promise.resolve([]),
    ]);

  const stats = [
    { label: t("totalUnits"), value: totalUnits },
    { label: t("pendingTickets"), value: pendingTickets },
    { label: t("deliveredUnits"), value: deliveredUnits },
    { label: t("legalDisputes"), value: legalDisputes },
  ];

  const isCsAgent = session?.user.role === "CS_AGENT";

  return (
    <div className="space-y-8">
      <div className={cn(entranceAnimationClass, "animate-delay-75")}>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t("welcome")}</h1>
        <p className="text-muted-foreground">{session?.user.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <Card
            key={stat.label}
            className={cn(
              premiumCardHoverClass,
              entranceAnimationClass,
              staggerEntranceClass(index)
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-heading text-3xl font-bold tabular-nums">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isCsAgent ? <PendingWorkQueue items={pendingWork} /> : null}
    </div>
  );
}
