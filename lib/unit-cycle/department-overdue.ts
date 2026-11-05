import type { Role } from "@prisma/client";

export type DepartmentOverdueHomeRole = "LEGAL" | "FINANCE";

export function isDepartmentOverdueHomeRole(
  role: Role
): role is DepartmentOverdueHomeRole {
  return role === "LEGAL" || role === "FINANCE";
}

export function departmentOverdueTasksBasePath(
  role: DepartmentOverdueHomeRole
): string {
  return role === "LEGAL" ? "/legal/overdue-tasks" : "/finance/overdue-tasks";
}

export function departmentOverdueHomePath(role: Role): string | null {
  if (!isDepartmentOverdueHomeRole(role)) return null;
  return departmentOverdueTasksBasePath(role);
}
