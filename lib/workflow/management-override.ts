import type { Role } from "@prisma/client";

const MANAGEMENT_OVERRIDE_EMAILS = [
  "madonna.hanna@newjerseyegypt.com",
  "reda.youssef@newjerseyegypt.com",
] as const;

export function canUseManagementOverride(user: {
  role: Role;
  email?: string | null;
}): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  const email = (user.email ?? "").toLowerCase();
  return MANAGEMENT_OVERRIDE_EMAILS.some((allowed) => email === allowed);
}

export function canBypassResolutionGates(user: {
  role: Role;
  email?: string | null;
}): boolean {
  return user.role === "SUPER_ADMIN";
}
