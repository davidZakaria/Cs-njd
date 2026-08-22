import { cookies } from "next/headers";

import { basePrisma } from "@/lib/prisma";
import {
  MAINTENANCE_MODE_KEY,
  MAINTENANCE_COOKIE,
  maintenanceCookieOptions,
  maintenanceCookieValue,
} from "@/lib/system/maintenance-cookie";

export { MAINTENANCE_MODE_KEY } from "@/lib/system/maintenance-cookie";

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

export { maintenanceCookieOptions };
