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

export function isMaintenanceRoute(path: string): boolean {
  return path.startsWith("/maintenance");
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
    "/print",
  ],
  MANAGEMENT: ["/executive", "/dashboard", "/cases", "/units", "/users", "/print"],
  CS_AGENT: ["/dashboard", "/cases", "/units", "/print"],
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

export type NavItemKey =
  | "dashboard"
  | "executive"
  | "cases"
  | "units"
  | "users"
  | "imports"
  | "auditLogs"
  | "backups"
  | "system"
  | "loginHistory"
  | "systemHealth"
  | "systemSettings";

export type NavGroupKey =
  | "usersSecurity"
  | "dataHub"
  | "monitoring"
  | "systemAdmin";

export function getCoreNavItems(role: Role) {
  const items: Array<{ href: string; key: NavItemKey; roles: Role[] }> = [
    { href: "/executive", key: "executive", roles: ["SUPER_ADMIN", "MANAGEMENT"] },
    { href: "/dashboard", key: "dashboard", roles: ["SUPER_ADMIN", "CS_AGENT"] },
    { href: "/cases", key: "cases", roles: ["SUPER_ADMIN", "MANAGEMENT", "CS_AGENT"] },
    { href: "/units", key: "units", roles: ["SUPER_ADMIN", "MANAGEMENT", "CS_AGENT"] },
  ];

  return items.filter((item) => item.roles.includes(role));
}

export function getSuperAdminNavGroups(): Array<{
  key: NavGroupKey;
  items: Array<{ href: string; key: NavItemKey }>;
}> {
  return [
    {
      key: "usersSecurity",
      items: [
        { href: "/users", key: "users" },
        { href: "/system/security", key: "loginHistory" },
      ],
    },
    {
      key: "dataHub",
      items: [
        { href: "/imports", key: "imports" },
        { href: "/backups", key: "backups" },
        { href: "/audit-logs", key: "auditLogs" },
      ],
    },
    {
      key: "monitoring",
      items: [{ href: "/system/monitoring", key: "systemHealth" }],
    },
    {
      key: "systemAdmin",
      items: [
        { href: "/system/settings", key: "systemSettings" },
        { href: "/system", key: "system" },
      ],
    },
  ];
}

export function getNavItems(role: Role) {
  const all: Array<{
    href: string;
    key: NavItemKey;
    roles: Role[];
  }> = [
    { href: "/executive", key: "executive", roles: ["SUPER_ADMIN", "MANAGEMENT"] },
    { href: "/dashboard", key: "dashboard", roles: ["SUPER_ADMIN", "CS_AGENT"] },
    { href: "/cases", key: "cases", roles: ["SUPER_ADMIN", "MANAGEMENT", "CS_AGENT"] },
    { href: "/units", key: "units", roles: ["SUPER_ADMIN", "MANAGEMENT", "CS_AGENT"] },
    { href: "/users", key: "users", roles: ["MANAGEMENT"] },
    { href: "/imports", key: "imports", roles: ["SUPER_ADMIN"] },
    { href: "/audit-logs", key: "auditLogs", roles: ["SUPER_ADMIN"] },
    { href: "/backups", key: "backups", roles: ["SUPER_ADMIN"] },
    { href: "/system", key: "system", roles: ["SUPER_ADMIN"] },
  ];

  return all.filter((item) => item.roles.includes(role));
}
