import { basePrisma as prisma } from "@/lib/prisma";
import { isLikelyAgentName } from "@/lib/import/columns";
import {
  buildStaffAliasMap,
  normalizeAgentKey,
  STAFF_EMAILS,
} from "@/lib/staff";

export type AgentResolver = {
  resolve: (rawName?: string | null) => Promise<string | null>;
  readonly unresolvedCount: number;
};

/** Resolves Excel agent names to existing users — never creates accounts. */
export async function createAgentResolver(): Promise<AgentResolver> {
  const aliasToEmail = buildStaffAliasMap();

  const users = await prisma.user.findMany({
    where: { email: { in: [...STAFF_EMAILS] } },
    select: { id: true, name: true, email: true },
  });

  const idByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user.id]));
  const idByName = new Map(users.map((user) => [normalizeAgentKey(user.name), user.id]));

  let unresolvedCount = 0;

  async function resolve(rawName?: string | null): Promise<string | null> {
    if (!isLikelyAgentName(rawName)) return null;

    const clean = rawName!.trim();
    const normalized = normalizeAgentKey(clean);

    const staffEmail = aliasToEmail.get(normalized);
    if (staffEmail) {
      const staffId = idByEmail.get(staffEmail.toLowerCase());
      if (staffId) return staffId;
    }

    if (idByName.has(normalized)) {
      return idByName.get(normalized)!;
    }

    for (const user of users) {
      const userKey = normalizeAgentKey(user.name);
      if (userKey.includes(normalized) || normalized.includes(userKey)) {
        return user.id;
      }
    }

    unresolvedCount += 1;
    return null;
  }

  return {
    resolve,
    get unresolvedCount() {
      return unresolvedCount;
    },
  };
}
