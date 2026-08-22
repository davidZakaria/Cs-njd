import type { Role } from "@prisma/client";

export type UserManagementActor = {
  id: string;
  role: Role;
};

export type UserManagementTarget = {
  id: string;
  role: Role;
  is2FAEnabled: boolean;
  hasTwoFactorSecret: boolean;
};

export function canEditUser(
  actor: UserManagementActor,
  target: UserManagementTarget
): boolean {
  if (!["SUPER_ADMIN", "MANAGEMENT"].includes(actor.role)) return false;
  if (target.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    return false;
  }
  return true;
}

export function canResetUser2FA(
  actor: UserManagementActor,
  target: UserManagementTarget
): boolean {
  if (actor.role !== "SUPER_ADMIN") return false;
  if (actor.id === target.id) return false;
  if (target.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    return false;
  }
  return target.is2FAEnabled || target.hasTwoFactorSecret;
}

export function canForcePasswordReset(
  actor: UserManagementActor,
  target: UserManagementTarget
): boolean {
  if (!["SUPER_ADMIN", "MANAGEMENT"].includes(actor.role)) return false;
  if (actor.id === target.id) return false;
  if (target.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    return false;
  }
  return true;
}

export function canDeleteUser(
  actor: UserManagementActor,
  target: UserManagementTarget
): boolean {
  if (actor.role !== "SUPER_ADMIN") return false;
  if (actor.id === target.id) return false;
  if (target.role === "SUPER_ADMIN") return false;
  return true;
}

export function hasAnyUserAction(
  actor: UserManagementActor,
  target: UserManagementTarget
): boolean {
  return (
    canEditUser(actor, target) ||
    canResetUser2FA(actor, target) ||
    canForcePasswordReset(actor, target) ||
    canDeleteUser(actor, target)
  );
}
