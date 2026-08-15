import type { Role } from "@prisma/client";

export function isPublicRoute(path: string): boolean {
  return path === "/" || path.startsWith("/login");
}

export function isPasswordChangeRoute(path: string): boolean {
  return path.startsWith("/force-password-change");
}

export function isAuthRoute(path: string): boolean {
  return (
    path.startsWith("/login") ||
    path.startsWith("/setup-2fa") ||
    path.startsWith("/verify-2fa") ||
    path.startsWith("/force-password-change")
  );
}

const roleRoutes: Record<Role, string[]> = {
  SUPER_ADMIN: [
    "/dashboard",
    "/executive",
    "/cases",
    "/units",
    "/users",
    "/imports",
    "/audit-logs",
    "/backups",
    "/system",
  ],
  MANAGEMENT: ["/executive", "/dashboard", "/cases", "/units", "/users"],
  CS_AGENT: ["/dashboard", "/cases", "/units"],
};

export function getHomeRoute(role: Role): string {
  return role === "MANAGEMENT" ? "/executive" : "/dashboard";
}

export function canAccessRoute(role: Role, path: string): boolean {
  const allowed = roleRoutes[role] ?? [];
  return allowed.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );
}

export function getNavItems(role: Role) {
  const all: Array<{
    href: string;
    key:
      | "dashboard"
      | "executive"
      | "cases"
      | "units"
      | "users"
      | "imports"
      | "auditLogs"
      | "backups"
      | "system";
    roles: Role[];
  }> = [
    { href: "/executive", key: "executive", roles: ["SUPER_ADMIN", "MANAGEMENT"] },
    { href: "/dashboard", key: "dashboard", roles: ["SUPER_ADMIN", "CS_AGENT"] },
    { href: "/cases", key: "cases", roles: ["SUPER_ADMIN", "MANAGEMENT", "CS_AGENT"] },
    { href: "/units", key: "units", roles: ["SUPER_ADMIN", "MANAGEMENT", "CS_AGENT"] },
    { href: "/users", key: "users", roles: ["SUPER_ADMIN", "MANAGEMENT"] },
    { href: "/imports", key: "imports", roles: ["SUPER_ADMIN"] },
    { href: "/audit-logs", key: "auditLogs", roles: ["SUPER_ADMIN"] },
    { href: "/backups", key: "backups", roles: ["SUPER_ADMIN"] },
    { href: "/system", key: "system", roles: ["SUPER_ADMIN"] },
  ];

  return all.filter((item) => item.roles.includes(role));
}
