import createMiddleware from "next-intl/middleware";
import { auth } from "@/lib/auth";
import { routing } from "@/i18n/routing";
import { NextResponse } from "next/server";
import {
  canAccessRoute,
  getHomeRoute,
  isAuthRoute,
  isLoginRoute,
  isMaintenanceRoute,
  isPasswordChangeRoute,
  isPublicRoute,
} from "@/lib/rbac";
import {
  maintenanceCookieOptions,
  parseMaintenanceCookie,
} from "@/lib/system/maintenance-cookie";
import { resolveMaintenanceActive } from "@/lib/system/maintenance-request";

const intlMiddleware = createMiddleware(routing);

function attachMaintenanceCookie(
  response: NextResponse,
  enabled: boolean
): NextResponse {
  response.cookies.set(maintenanceCookieOptions(enabled));
  return response;
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const hasLocalePrefix = routing.locales.includes(segments[0] as "en" | "ar");

  if (segments[0] && !hasLocalePrefix) {
    const rest = segments.join("/");
    const target =
      rest === "login" || rest.startsWith("login/")
        ? `/${routing.defaultLocale}/login`
        : `/${routing.defaultLocale}/login`;
    return NextResponse.redirect(new URL(target, req.url));
  }

  const locale = hasLocalePrefix
    ? segments[0]
    : routing.defaultLocale;
  const pathWithoutLocale = "/" + segments.slice(hasLocalePrefix ? 1 : 0).join("/");
  const normalizedPath = pathWithoutLocale === "/" ? "/" : pathWithoutLocale.replace(/\/$/, "") || "/";

  if (isPublicRoute(normalizedPath)) {
    return intlMiddleware(req);
  }

  if (!req.auth?.user) {
    if (isLoginRoute(normalizedPath)) {
      return intlMiddleware(req);
    }
    const loginUrl = new URL(`/${locale}/login`, req.url);
    if (
      normalizedPath.startsWith("/verify-2fa") ||
      normalizedPath.startsWith("/setup-2fa")
    ) {
      loginUrl.searchParams.set("reason", "session_expired");
    }
    return NextResponse.redirect(loginUrl);
  }

  const user = req.auth.user;

  if (user.requiresPasswordChange) {
    if (!isPasswordChangeRoute(normalizedPath)) {
      return NextResponse.redirect(
        new URL(`/${locale}/force-password-change`, req.url)
      );
    }
    return intlMiddleware(req);
  }

  if (isPasswordChangeRoute(normalizedPath)) {
    const home = getHomeRoute(user.role);
    return NextResponse.redirect(new URL(`/${locale}${home}`, req.url));
  }

  if (
    !user.twoFactorVerified &&
    !normalizedPath.startsWith("/setup-2fa") &&
    !normalizedPath.startsWith("/verify-2fa")
  ) {
    if (user.needs2FASetup) {
      return NextResponse.redirect(new URL(`/${locale}/setup-2fa`, req.url));
    }
    return NextResponse.redirect(new URL(`/${locale}/verify-2fa`, req.url));
  }

  if (user.twoFactorVerified && isAuthRoute(normalizedPath)) {
    const home = getHomeRoute(user.role);
    return NextResponse.redirect(new URL(`/${locale}${home}`, req.url));
  }

  const cookieMaintenance = parseMaintenanceCookie(
    req.cookies.get("njd_maintenance_mode")?.value
  );
  const maintenanceActive = await resolveMaintenanceActive(req);
  const shouldSyncCookie = cookieMaintenance !== maintenanceActive;

  if (maintenanceActive && user.role !== "SUPER_ADMIN") {
    if (!isMaintenanceRoute(normalizedPath)) {
      const redirect = NextResponse.redirect(
        new URL(`/${locale}/maintenance`, req.url)
      );
      return shouldSyncCookie
        ? attachMaintenanceCookie(redirect, maintenanceActive)
        : redirect;
    }

    const response = intlMiddleware(req);
    return shouldSyncCookie
      ? attachMaintenanceCookie(response, maintenanceActive)
      : response;
  }

  if (!maintenanceActive && isMaintenanceRoute(normalizedPath)) {
    const home = getHomeRoute(user.role);
    const redirect = NextResponse.redirect(
      new URL(`/${locale}${home}`, req.url)
    );
    return shouldSyncCookie
      ? attachMaintenanceCookie(redirect, maintenanceActive)
      : redirect;
  }

  // Auth flow pages (login, setup/verify 2FA) are outside RBAC route lists.
  if (isAuthRoute(normalizedPath)) {
    return intlMiddleware(req);
  }

  if (!canAccessRoute(user.role, normalizedPath)) {
    const home = getHomeRoute(user.role);
    const redirect = NextResponse.redirect(new URL(`/${locale}${home}`, req.url));
    return shouldSyncCookie
      ? attachMaintenanceCookie(redirect, maintenanceActive)
      : redirect;
  }

  const response = intlMiddleware(req);
  return shouldSyncCookie
    ? attachMaintenanceCookie(response, maintenanceActive)
    : response;
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
