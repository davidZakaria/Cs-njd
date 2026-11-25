import { getLocale, getTranslations } from "next-intl/server";

import { TwoFactorResetRequestsTable } from "@/components/users/two-factor-reset-requests-table";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TwoFactorResetRequestsPage() {
  await requireSuperAdmin();
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("users.twoFactorResetRequests"),
  ]);

  const [pending, consumed] = await Promise.all([
    prisma.twoFactorResetRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { requestedAt: "asc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    }),
    prisma.twoFactorResetRequest.findMany({
      where: {
        status: "APPROVED",
        usedAt: { not: null },
      },
      orderBy: { usedAt: "desc" },
      take: 20,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    }),
  ]);

  const rows = pending
    .filter((request) => request.user)
    .map((request) => ({
      userId: request.user!.id,
      userName: request.user!.name,
      userEmail: request.user!.email,
      userRole: request.user!.role,
      requestedAtLabel: formatDateTime(request.requestedAt, locale),
    }));

  const consumedRows = consumed
    .filter((request) => request.user && request.usedAt)
    .map((request) => ({
      userId: request.user!.id,
      userName: request.user!.name,
      userEmail: request.user!.email,
      userRole: request.user!.role,
      requestedAtLabel: formatDateTime(request.requestedAt, locale),
      consumedAtLabel: formatDateTime(request.usedAt!, locale),
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

      {consumedRows.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{t("consumedTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("consumedSubtitle")}
            </p>
          </div>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("columns.user")}</th>
                  <th className="px-4 py-3 font-medium">{t("columns.consumedAt")}</th>
                </tr>
              </thead>
              <tbody>
                {consumedRows.map((row) => (
                  <tr key={`${row.userId}-${row.consumedAtLabel}`} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.userName}</div>
                      <div className="text-muted-foreground">{row.userEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.consumedAtLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}