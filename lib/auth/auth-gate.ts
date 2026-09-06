import type { Role } from "@prisma/client";

import { isTwoFactorRequired } from "@/lib/auth/two-factor-policy";

export type AuthGateUser = {
  role: Role;
  requiresPasswordChange?: boolean;
  needs2FASetup?: boolean;
  twoFactorVerified?: boolean;
};

export function getAuthGatePath(user: AuthGateUser): string {
  if (user.requiresPasswordChange) {
    return "/force-password-change";
  }

  if (isTwoFactorRequired(user.role)) {
    if (user.needs2FASetup) {
      return "/setup-2fa";
    }
    if (!user.twoFactorVerified) {
      return "/verify-2fa";
    }
  }

  if (user.role === "MANAGEMENT") return "/executive";
  if (user.role === "ENGINEER") return "/engineering";
  return "/dashboard";
}

export function getAuthGateRedirect(locale: string, user: AuthGateUser): string {
  return `/${locale}${getAuthGatePath(user)}`;
}
