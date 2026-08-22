/** Edge/middleware-safe maintenance cookie helpers (no Prisma or next/headers). */

export const MAINTENANCE_MODE_KEY = "MAINTENANCE_MODE";
export const MAINTENANCE_COOKIE = "njd_maintenance_mode";

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
