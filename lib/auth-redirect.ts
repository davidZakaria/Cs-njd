import type { Role } from "@prisma/client";
import { routing, type Locale } from "@/i18n/routing";
import { isPasswordChangeRoute } from "@/lib/rbac";
import {
  getAuthGatePath,
  type AuthGateUser,
} from "@/lib/auth/auth-gate";

export { isPasswordChangeRoute };

type PostAuthUser = AuthGateUser & {
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
  return getAuthGatePath(user);
}

/** Ordered gate: password change → 2FA setup → 2FA verify → home. */
export function getPostAuthRedirect(locale: string, user: PostAuthUser): string {
  const safeLocale = resolveLocale(locale);
  return `/${safeLocale}${getPostAuthPath(user)}`;
}
