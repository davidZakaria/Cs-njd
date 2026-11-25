import type { PrismaClient } from "@prisma/client";

import {
  LATE_REQUEST_WATCHERS_KEY,
  parseLateRequestWatchersValue,
  type LateRequestWatchersConfig,
} from "@/lib/system/late-request-watchers-config";

export type LateRequestWatchersDb = Pick<
  PrismaClient,
  "user" | "systemSetting"
>;

/** Default recipients: active Management users (not Super Admin unless included). */
export async function resolveLateRequestWatcherUserIds(
  prisma: LateRequestWatchersDb,
  configOverride?: string | null | LateRequestWatchersConfig
): Promise<string[]> {
  const config: LateRequestWatchersConfig =
    configOverride == null
      ? await loadLateRequestWatchersConfig(prisma)
      : typeof configOverride === "string"
        ? parseLateRequestWatchersValue(configOverride)
        : configOverride;

  const managementUsers = await prisma.user.findMany({
    where: {
      role: "MANAGEMENT",
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  const ids = new Set(managementUsers.map((user) => user.id));

  for (const id of config.include) {
    ids.add(id);
  }
  for (const id of config.exclude) {
    ids.delete(id);
  }

  if (ids.size === 0) {
    return [];
  }

  const active = await prisma.user.findMany({
    where: {
      id: { in: [...ids] },
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  return active.map((user) => user.id);
}

export async function loadLateRequestWatchersConfig(
  prisma: LateRequestWatchersDb
): Promise<LateRequestWatchersConfig> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: LATE_REQUEST_WATCHERS_KEY },
    select: { value: true },
  });
  return parseLateRequestWatchersValue(row?.value);
}