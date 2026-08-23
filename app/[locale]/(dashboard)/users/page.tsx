import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { UsersDataTable } from "@/components/users/users-data-table";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";
import { cn } from "@/lib/utils";

export default async function UsersPage() {
  const session = await auth();
  const t = await getTranslations("users");

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      NOT: { email: { endsWith: "@imported.njd.local" } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      is2FAEnabled: true,
      twoFactorSecret: true,
    },
  });

  const userRows = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is2FAEnabled: user.is2FAEnabled,
    hasTwoFactorSecret: Boolean(user.twoFactorSecret),
  }));

  const canCreate =
    session?.user.role === "SUPER_ADMIN" || session?.user.role === "MANAGEMENT";

  return (
    <div className="space-y-6">
      <div className={cn(entranceAnimationClass, "animate-delay-75")}>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <UsersDataTable
        data={userRows}
        canCreate={canCreate}
        isSuperAdmin={session?.user.role === "SUPER_ADMIN"}
        currentUserId={session!.user.id}
        currentUserRole={session!.user.role}
      />
    </div>
  );
}
