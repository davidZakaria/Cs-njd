import { cookies } from "next/headers";

import { basePrisma } from "@/lib/prisma";

export const MAINTENANCE_MODE_KEY = "MAINTENANCE_MODE";
export const MAINTENANCE_COOKIE = "njd_maintenance_mode";

export async function getMaintenanceMode(): Promise<boolean> {
  const row = await basePrisma.systemSetting.findUnique({
    where: { key: MAINTENANCE_MODE_KEY },
    select: { value: true },
  });

  return row?.value === "true";
}

export async function setMaintenanceMode(enabled: boolean): Promise<void> {
  const value = enabled ? "true" : "false";

  await basePrisma.systemSetting.upsert({
    where: { key: MAINTENANCE_MODE_KEY },
    create: { key: MAINTENANCE_MODE_KEY, value },
    update: { value },
  });
}

export function maintenanceCookieValue(enabled: boolean): "0" | "1" {
  return enabled ? "1" : "0";
}

export function parseMaintenanceCookie(
  value: string | undefined
): boolean | null {
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

export async function syncMaintenanceCookie(): Promise<boolean> {
  const enabled = await getMaintenanceMode();
  const cookieStore = await cookies();

  cookieStore.set(MAINTENANCE_COOKIE, maintenanceCookieValue(enabled), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return enabled;
}

export function maintenanceCookieOptions(enabled: boolean) {
  return {
    name: MAINTENANCE_COOKIE,
    value: maintenanceCookieValue(enabled),
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
