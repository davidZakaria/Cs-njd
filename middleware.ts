import createMiddleware from "next-intl/middleware";
import { auth } from "@/lib/auth";
import { routing } from "@/i18n/routing";
import { NextResponse } from "next/server";
import { canAccessRoute, getHomeRoute, isAuthRoute, isPasswordChangeRoute, isPublicRoute } from "@/lib/rbac";

const intlMiddleware = createMiddleware(routing);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const locale = routing.locales.includes(segments[0] as "en" | "ar")
    ? segments[0]
    : routing.defaultLocale;
  const pathWithoutLocale = "/" + segments.slice(routing.locales.includes(segments[0] as "en" | "ar") ? 1 : 0).join("/");
  const normalizedPath = pathWithoutLocale === "/" ? "/" : pathWithoutLocale.replace(/\/$/, "") || "/";

  if (isPublicRoute(normalizedPath)) {
    return intlMiddleware(req);
  }

  if (!req.auth?.user) {
    if (!isAuthRoute(normalizedPath)) {
      return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
    }
    return intlMiddleware(req);
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

  // Auth flow pages (login, setup/verify 2FA) are outside RBAC route lists.
  if (isAuthRoute(normalizedPath)) {
    return intlMiddleware(req);
  }

  if (!canAccessRoute(user.role, normalizedPath)) {
    const home = getHomeRoute(user.role);
    return NextResponse.redirect(new URL(`/${locale}${home}`, req.url));
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
