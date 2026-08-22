import type { Role } from "@prisma/client";
import { routing, type Locale } from "@/i18n/routing";
import { getHomeRoute, isPasswordChangeRoute } from "@/lib/rbac";

export { isPasswordChangeRoute };

type PostAuthUser = {
  requiresPasswordChange?: boolean;
  needs2FASetup?: boolean;
  twoFactorVerified?: boolean;
  role: Role;
};

export function resolveLocale(locale: string | undefined): Locale {
  if (locale && routing.locales.includes(locale as Locale)) {
    return locale as Locale;
  }
  return routing.defaultLocale;
}

/** Locale-agnostic app path after auth gates (for next-intl router). */
export function getPostAuthPath(user: PostAuthUser): string {
  if (user.requiresPasswordChange) {
    return "/force-password-change";
  }
  if (user.needs2FASetup) {
    return "/setup-2fa";
  }
  if (!user.twoFactorVerified) {
    return "/verify-2fa";
  }
  return getHomeRoute(user.role);
}

/** Ordered gate: password change → 2FA setup → 2FA verify → home. */
export function getPostAuthRedirect(locale: string, user: PostAuthUser): string {
  const safeLocale = resolveLocale(locale);
  return `/${safeLocale}${getPostAuthPath(user)}`;
}
