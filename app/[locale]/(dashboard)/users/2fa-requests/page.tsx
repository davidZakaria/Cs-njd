import { getLocale, getTranslations } from "next-intl/server";

import { TwoFactorResetRequestsTable } from "@/components/users/two-factor-reset-requests-table";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TwoFactorResetRequestsPage() {
  await requireSuperAdmin();
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("users.twoFactorResetRequests"),
  ]);

  const pending = await prisma.twoFactorResetRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { requestedAt: "asc" },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  const rows = pending
    .filter((request) => request.user)
    .map((request) => ({
      userId: request.user!.id,
      userName: request.user!.name,
      userEmail: request.user!.email,
      userRole: request.user!.role,
      requestedAtLabel: request.requestedAt.toLocaleString(
        locale === "ar" ? "ar-EG" : "en-GB"
      ),
    }));

  return (
    <div className="space-y-6">
      <div className={cn(entranceAnimationClass, "animate-delay-75")}>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <TwoFactorResetRequestsTable rows={rows} />
    </div>
  );
}
