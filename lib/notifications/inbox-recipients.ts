import type { Role } from "@prisma/client";

type UserLookupDb = {
  user: {
    findMany: (args: {
      where: {
        role: { in: Role[] };
        deletedAt: null;
        isActive: boolean;
      };
      select: { id: true };
    }) => Promise<Array<{ id: string }>>;
  };
};

/** Read-only: active users that would receive a role-scoped inbox notification. */
export async function resolveActiveUserIdsForRoles(
  db: UserLookupDb,
  roles: Role[]
): Promise<string[]> {
  if (roles.length === 0) return [];

  const users = await db.user.findMany({
    where: { role: { in: roles }, deletedAt: null, isActive: true },
    select: { id: true },
  });

  return [...new Set(users.map((user) => user.id))];
}