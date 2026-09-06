import type { Role } from "@prisma/client";

/** Site engineers use password-only login (shared on-site account). */
export function isTwoFactorRequired(role: Role): boolean {
  return role !== "ENGINEER";
}

export function engineerSessionFlags(role: Role) {
  if (role !== "ENGINEER") {
    return null;
  }
  return {
    is2FAEnabled: false,
    needs2FASetup: false,
    twoFactorVerified: true,
  };
}
