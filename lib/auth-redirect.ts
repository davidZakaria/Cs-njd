import type { Role } from "@prisma/client";
import { getHomeRoute, isPasswordChangeRoute } from "@/lib/rbac";

export { isPasswordChangeRoute };

type PostAuthUser = {
  requiresPasswordChange?: boolean;
  needs2FASetup?: boolean;
  twoFactorVerified?: boolean;
  role: Role;
};

/** Ordered gate: password change → 2FA setup → 2FA verify → home. */
export function getPostAuthRedirect(locale: string, user: PostAuthUser): string {
  if (user.requiresPasswordChange) {
    return `/${locale}/force-password-change`;
  }
  if (user.needs2FASetup) {
    return `/${locale}/setup-2fa`;
  }
  if (!user.twoFactorVerified) {
    return `/${locale}/verify-2fa`;
  }
  return `/${locale}${getHomeRoute(user.role)}`;
}
