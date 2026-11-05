import type { Role } from "@prisma/client";

export function isPublicRoute(path: string): boolean {
  return path === "/" || path.startsWith("/login");
}

export function isPasswordChangeRoute(path: string): boolean {
  return path.startsWith("/force-password-change");
}

export function isLoginRoute(path: string): boolean {
  return path.startsWith("/login");
}

export function isTwoFactorFlowRoute(path: string): boolean {
  return (
    path.startsWith("/setup-2fa") ||
    path.startsWith("/verify-2fa") ||
    isPasswordChangeRoute(path)
  );
}

export function isAuthRoute(path: string): boolean {
  return isLoginRoute(path) || isTwoFactorFlowRoute(path);
}

export function isMaintenanceRoute(path: string): boolean {
  return path.startsWith("/maintenance");
}

const departmentStaffRoutes = ["/requests", "/print"];

const rolesWithUnitsList: Role[] = [
  "SUPER_ADMIN",
  "MANAGEMENT",
  "CS_AGENT",
  "COMMUNITY_MANAGEMENT",
];

const rolesWithNotifications: Role[] = [
  "SUPER_ADMIN",
  "MANAGEMENT",
  "CS_AGENT",
  "COMMUNITY_MANAGEMENT",
];

const rolesWithUnitDetailAccess: Role[] = [
  ...rolesWithUnitsList,
  "LEGAL",
  "FINANCE",
  "OPERATIONS",
];

export function isUnitsListRoute(path: string): boolean {
  return path === "/units";
}

export function isUnitDetailRoute(path: string): boolean {
  return /^\/units\/[^/]+(\/.*)?$/.test(path);
}

export function isNotificationsRoute(path: string): boolean {
  return path === "/notifications" || path.startsWith("/notifications/");
}

const roleRoutes: Record<Role, string[]> = {
  SUPER_ADMIN: [
    "/dashboard",
    "/executive",
    "/operations",
    "/requests",
    "/cases",
    "/units",
    "/users",
    "/imports",
    "/audit-logs",
    "/backups",
    "/system",
    "/notifications",
    "/print",
    "/legal",
    "/finance",
  ],
  MANAGEMENT: [
    "/executive",
    "/operations",
    "/requests",
    "/dashboard",
    "/cases",
    "/units",
    "/notifications",
    "/users",
    "/print",
  ],
  CS_AGENT: [
    "/dashboard",
    "/operations",
    "/requests",
    "/cases",
    "/units",
    "/notifications",
    "/print",
  ],
  COMMUNITY_MANAGEMENT: [
    "/dashboard",
    "/requests",
    "/cases",
    "/units",
    "/notifications",
    "/print",
  ],
  ENGINEER: ["/engineering"],
  OPERATIONS: ["/operations", "/operations/requests", "/print"],
  LEGAL: ["/legal", "/legal/overdue-tasks", ...departmentStaffRoutes],
  FINANCE: ["/finance", "/finance/overdue-tasks", ...departmentStaffRoutes],
};

export function getHomeRoute(role: Role): string {
  if (role === "MANAGEMENT") return "/executive";
  if (role === "ENGINEER") return "/engineering";
  if (role === "OPERATIONS") return "/operations";
  if (role === "LEGAL") return "/legal";
  if (role === "FINANCE") return "/finance";
  return "/dashboard";
}

export function canAccessRoute(role: Role, path: string): boolean {
  if (isUnitsListRoute(path)) {
    return rolesWithUnitsList.includes(role);
  }
  if (isNotificationsRoute(path)) {
    return rolesWithNotifications.includes(role);
  }
  if (isUnitDetailRoute(path)) {
    return rolesWithUnitDetailAccess.includes(role);
  }

  const allowed = roleRoutes[role] ?? [];
  return allowed.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );
}

export type NavItemKey =
  | "dashboard"
  | "executive"
  | "operations"
  | "requests"
  | "cases"
  | "units"
  | "engineering"
  | "legalHome"
  | "financeHome"
  | "users"
  | "imports"
  | "auditLogs"
  | "backups"
  | "system"
  | "loginHistory"
  | "twoFactorRequests"
  | "systemHealth"
  | "systemSettings"
  | "notificationsLog"
  | "activityNotifications"
  | "operationsRequests"
  | "overdueTasks";

export type NavGroupKey =
  | "usersSecurity"
  | "dataHub"
  | "monitoring"
  | "systemAdmin";

export function getCoreNavItems(role: Role) {
  if (role === "ENGINEER") {
    return [{ href: "/engineering", key: "engineering" as const, roles: ["ENGINEER" as Role] }];
  }

  if (role === "OPERATIONS") {
    return [
      { href: "/operations", key: "operations" as const, roles: ["OPERATIONS" as Role] },
      {
        href: "/operations/requests",
        key: "operationsRequests" as const,
        roles: ["OPERATIONS" as Role],
      },
    ];
  }

  if (role === "LEGAL") {
    return [
      { href: "/legal", key: "legalHome" as const, roles: ["LEGAL" as Role] },
      { href: "/requests", key: "requests" as const, roles: ["LEGAL" as Role] },
    ];
  }

  if (role === "FINANCE") {
    return [
      { href: "/finance", key: "financeHome" as const, roles: ["FINANCE" as Role] },
      { href: "/requests", key: "requests" as const, roles: ["FINANCE" as Role] },
    ];
  }

  const items: Array<{ href: string; key: NavItemKey; roles: Role[] }> = [
    { href: "/executive", key: "executive", roles: ["SUPER_ADMIN", "MANAGEMENT"] },
    {
      href: "/executive/overdue-tasks",
      key: "overdueTasks",
      roles: ["SUPER_ADMIN", "MANAGEMENT"],
    },
    {
      href: "/operations",
      key: "operations",
      roles: ["SUPER_ADMIN", "MANAGEMENT", "OPERATIONS", "CS_AGENT"],
    },
    {
      href: "/requests",
      key: "requests",
      roles: [
        "SUPER_ADMIN",
        "MANAGEMENT",
        "CS_AGENT",
        "COMMUNITY_MANAGEMENT",
      ],
    },
    {
      href: "/dashboard",
      key: "dashboard",
      roles: ["SUPER_ADMIN", "CS_AGENT", "COMMUNITY_MANAGEMENT"],
    },
    {
      href: "/cases",
      key: "cases",
      roles: ["SUPER_ADMIN", "MANAGEMENT", "CS_AGENT", "COMMUNITY_MANAGEMENT"],
    },
    {
      href: "/units",
      key: "units",
      roles: [
        "SUPER_ADMIN",
        "MANAGEMENT",
        "CS_AGENT",
        "COMMUNITY_MANAGEMENT",
      ],
    },
    {
      href: "/notifications",
      key: "activityNotifications",
      roles: [
        "SUPER_ADMIN",
        "MANAGEMENT",
        "CS_AGENT",
        "COMMUNITY_MANAGEMENT",
      ],
    },
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
        { href: "/users/2fa-requests", key: "twoFactorRequests" },
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
      items: [
        { href: "/system/monitoring", key: "systemHealth" },
        { href: "/system/notifications-log", key: "notificationsLog" },
      ],
    },
    {
      key: "systemAdmin",
      items: [
        { href: "/system/general-settings", key: "systemSettings" },
        { href: "/system/system", key: "system" },
      ],
    },
  ];
}

export function getNavItems(role: Role) {
  if (role === "ENGINEER") {
    return [{ href: "/engineering", key: "engineering" as const, roles: ["ENGINEER" as Role] }];
  }

  if (role === "LEGAL") {
    return getCoreNavItems("LEGAL");
  }

  if (role === "FINANCE") {
    return getCoreNavItems("FINANCE");
  }

  if (role === "OPERATIONS") {
    return getCoreNavItems("OPERATIONS");
  }

  const all: Array<{
    href: string;
    key: NavItemKey;
    roles: Role[];
  }> = [
    { href: "/executive", key: "executive", roles: ["SUPER_ADMIN", "MANAGEMENT"] },
    {
      href: "/executive/overdue-tasks",
      key: "overdueTasks",
      roles: ["SUPER_ADMIN", "MANAGEMENT"],
    },
    {
      href: "/operations",
      key: "operations",
      roles: ["SUPER_ADMIN", "MANAGEMENT", "OPERATIONS", "CS_AGENT"],
    },
    {
      href: "/requests",
      key: "requests",
      roles: [
        "SUPER_ADMIN",
        "MANAGEMENT",
        "CS_AGENT",
        "COMMUNITY_MANAGEMENT",
      ],
    },
    {
      href: "/dashboard",
      key: "dashboard",
      roles: ["SUPER_ADMIN", "CS_AGENT", "COMMUNITY_MANAGEMENT"],
    },
    {
      href: "/cases",
      key: "cases",
      roles: ["SUPER_ADMIN", "MANAGEMENT", "CS_AGENT", "COMMUNITY_MANAGEMENT"],
    },
    {
      href: "/units",
      key: "units",
      roles: [
        "SUPER_ADMIN",
        "MANAGEMENT",
        "CS_AGENT",
        "COMMUNITY_MANAGEMENT",
      ],
    },
    {
      href: "/notifications",
      key: "activityNotifications",
      roles: [
        "SUPER_ADMIN",
        "MANAGEMENT",
        "CS_AGENT",
        "COMMUNITY_MANAGEMENT",
      ],
    },
    { href: "/users", key: "users", roles: ["MANAGEMENT"] },
    { href: "/imports", key: "imports", roles: ["SUPER_ADMIN"] },
    { href: "/audit-logs", key: "auditLogs", roles: ["SUPER_ADMIN"] },
    { href: "/backups", key: "backups", roles: ["SUPER_ADMIN"] },
    { href: "/system/system", key: "system", roles: ["SUPER_ADMIN"] },
  ];

  return all.filter((item) => item.roles.includes(role));
}
