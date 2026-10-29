import { auth } from "@/lib/auth";
import { redirect, Link } from "@/i18n/navigation";
import { canAccessOperationsProgressTracker } from "@/lib/auth/role-permissions";
import { getTranslations } from "next-intl/server";
import { prisma, notDeleted } from "@/lib/prisma";
import { notFound } from "next/navigation";
import {
  operationsUnitInclude,
} from "@/lib/operations/load-operations-units";
import { computeOperationsProgress } from "@/lib/operations/operations-progress";
import { mapUnitToOperationsProgressInput } from "@/lib/operations/map-unit-to-progress-input";
import { OperationsUnitChecklist } from "@/components/operations/operations-unit-checklist";
import { ChevronLeft } from "lucide-react";

export default async function OperationsUnitDetailPage({
  params,
}: {
  params: Promise<{ locale: string; unitId: string }>;
}) {
  const { locale, unitId } = await params;
  const session = await auth();
  const role = session?.user.role;

  if (!role || !canAccessOperationsProgressTracker(role)) {
    redirect({ href: "/", locale });
  }

  const t = await getTranslations("operations");

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, ...notDeleted },
    include: operationsUnitInclude,
  });

  if (!unit) notFound();

  const progress = computeOperationsProgress(
    mapUnitToOperationsProgressInput({
      gracePeriod: unit.gracePeriod,
      area: unit.area,
      clientId: unit.clientId,
      client: unit.client,
      unitClients: unit.unitClients,
      contractWorkflow: unit.contractWorkflow,
      finishing: unit.finishing,
    })
  );

  return (
    <div className="space-y-4">
      <Link
        href="/operations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {t("detail.back")}
      </Link>
      <OperationsUnitChecklist
        unitId={unit.id}
        unitCode={unit.unitCode}
        project={unit.project.name}
        clientName={unit.client?.name ?? "—"}
        progress={progress}
      />
    </div>
  );
}
