import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { TwoFactorResetReviewPanel } from "@/components/users/two-factor-reset-review-panel";
import { getDomainLabels } from "@/lib/i18n/domain-labels";

export default async function TwoFactorResetReviewPage({
  params,
}: {
  params: Promise<{ locale: string; userId: string }>;
}) {
  const { locale, userId } = await params;
  const session = await auth();
  const t = await getTranslations("users.twoFactorResetReview");
  const labels = await getDomainLabels(locale);

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    notFound();
  }

  const pending = await prisma.twoFactorResetRequest.findFirst({
    where: { userId, status: "PENDING" },
    orderBy: { requestedAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  if (!pending?.user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8 text-center">
        <h1 className="font-heading text-2xl font-bold">{t("noPendingTitle")}</h1>
        <p className="text-muted-foreground">{t("noPendingDescription")}</p>
      </div>
    );
  }

  const roleLabel = await labels.role(pending.user.role);
  const requestedAtLabel = pending.requestedAt.toLocaleString(
    locale === "ar" ? "ar-EG" : "en-GB"
  );

  return (
    <div className="space-y-6 py-4">
      <TwoFactorResetReviewPanel
        userId={pending.user.id}
        userName={pending.user.name}
        userEmail={pending.user.email}
        userRole={roleLabel}
        requestedAtLabel={requestedAtLabel}
      />
    </div>
  );
}
