import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { UsersCrudPanel } from "@/components/users/users-crud-panel";

export default async function UsersPage() {
  const session = await auth();
  const t = await getTranslations("users");

  const users = await prisma.user.findMany({
    where: { NOT: { email: { endsWith: "@imported.njd.local" } } },
    orderBy: { createdAt: "desc" },
  });

  const canCreate =
    session?.user.role === "SUPER_ADMIN" || session?.user.role === "MANAGEMENT";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <UsersCrudPanel
        users={users}
        canCreate={canCreate}
        isSuperAdmin={session?.user.role === "SUPER_ADMIN"}
      />
    </div>
  );
}
