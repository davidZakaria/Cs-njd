"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { basePrisma } from "@/lib/prisma";
import {
  MAINTENANCE_MODE_KEY,
  maintenanceCookieOptions,
} from "@/lib/system/maintenance-cookie";
import { SYSTEM_SETTINGS_CACHE_TAG } from "@/lib/system/settings-store";
import type { Session } from "next-auth";

export type SystemSettingsMap = Record<string, string>;

function assertSuperAdmin(session: Session | null) {
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }
}

/** Fetches all settings as a key-value map. SUPER_ADMIN only. */
export async function getSystemSettings(): Promise<SystemSettingsMap> {
  const session = await auth();
  assertSuperAdmin(session);

  const rows = await basePrisma.systemSetting.findMany({
    select: { key: true, value: true },
    orderBy: { key: "asc" },
  });

  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

/** Upserts a single setting and revalidates the app layout. SUPER_ADMIN only. */
export async function updateSystemSetting(
  key: string,
  value: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return actionFail("Unauthorized");
  }

  const trimmedKey = key.trim();
  if (!trimmedKey) {
    return actionFail("INVALID_KEY");
  }

  if (value.length > 10_000) {
    return actionFail("VALUE_TOO_LONG");
  }

  await basePrisma.systemSetting.upsert({
    where: { key: trimmedKey },
    create: { key: trimmedKey, value },
    update: { value },
  });

  if (trimmedKey === MAINTENANCE_MODE_KEY) {
    const cookieStore = await cookies();
    cookieStore.set(maintenanceCookieOptions(value === "true"));
  }

  revalidatePath("/", "layout");
  revalidateTag(SYSTEM_SETTINGS_CACHE_TAG, "max");
  return actionOk();
}

/** Revalidates cached layout data across the app. SUPER_ADMIN only. */
export async function clearSystemCache(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return actionFail("Unauthorized");
  }

  revalidatePath("/", "layout");
  revalidateTag(SYSTEM_SETTINGS_CACHE_TAG, "max");
  return actionOk("Application cache cleared");
}
