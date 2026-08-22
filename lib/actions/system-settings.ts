"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { maintenanceCookieOptions } from "@/lib/system/maintenance-cookie";
import { setMaintenanceMode } from "@/lib/system/maintenance-mode";

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

  revalidatePath("/system/settings");
  return actionOk(enabled ? "Maintenance mode enabled" : "Maintenance mode disabled");
}
