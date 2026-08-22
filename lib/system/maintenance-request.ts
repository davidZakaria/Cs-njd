import type { NextRequest } from "next/server";

import {
  MAINTENANCE_COOKIE,
  parseMaintenanceCookie,
} from "@/lib/system/maintenance-mode";

export async function resolveMaintenanceActive(
  req: NextRequest
): Promise<boolean> {
  const fromCookie = parseMaintenanceCookie(
    req.cookies.get(MAINTENANCE_COOKIE)?.value
  );

  if (fromCookie != null) {
    return fromCookie;
  }

  try {
    const response = await fetch(
      new URL("/api/system/maintenance", req.nextUrl.origin),
      { cache: "no-store" }
    );

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { enabled?: boolean };
    return data.enabled === true;
  } catch {
    return false;
  }
}
