import type { Role } from "@prisma/client";

/** Executive / management roles with full timeline CRUD on any unit. */
export function canManageUnitTickets(user: { role: Role }): boolean {
  return user.role === "SUPER_ADMIN" || user.role === "MANAGEMENT";
}
