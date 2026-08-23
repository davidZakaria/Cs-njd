"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { maintenanceCookieOptions } from "@/lib/system/maintenance-cookie";
import { setMaintenanceMode } from "@/lib/system/maintenance-mode";
import { SYSTEM_SETTINGS_CACHE_TAG } from "@/lib/system/settings-store";

export async function setMaintenanceModeAction(
  enabled: boolean
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return actionFail("Unauthorized");
  }

  await setMaintenanceMode(enabled);

  const cookieStore = await cookies();
  cookieStore.set(maintenanceCookieOptions(enabled));

  revalidatePath("/system/system");
  revalidatePath("/", "layout");
  revalidateTag(SYSTEM_SETTINGS_CACHE_TAG, "max");
  return actionOk(enabled ? "Maintenance mode enabled" : "Maintenance mode disabled");
}
