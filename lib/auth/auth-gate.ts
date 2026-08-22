import type { Role } from "@prisma/client";

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
  if (user.needs2FASetup) {
    return "/setup-2fa";
  }
  if (!user.twoFactorVerified) {
    return "/verify-2fa";
  }
  return user.role === "MANAGEMENT" ? "/executive" : "/dashboard";
}

export function getAuthGateRedirect(locale: string, user: AuthGateUser): string {
  return `/${locale}${getAuthGatePath(user)}`;
}
