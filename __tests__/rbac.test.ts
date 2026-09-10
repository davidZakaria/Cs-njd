import { describe, it, expect } from "vitest";
import {
  isPublicRoute,
  isLoginRoute,
  isPasswordChangeRoute,
  isTwoFactorFlowRoute,
  isAuthRoute,
  isMaintenanceRoute,
  canAccessRoute,
  getHomeRoute,
  getCoreNavItems,
  getNavItems,
} from "@/lib/rbac";

describe("RBAC Route Helpers", () => {
  describe("isPublicRoute", () => {
    it("returns true for root path", () => {
      expect(isPublicRoute("/")).toBe(true);
    });

    it("returns true for login path", () => {
      expect(isPublicRoute("/login")).toBe(true);
    });

    it("returns true for login subpaths", () => {
      expect(isPublicRoute("/login/callback")).toBe(true);
    });

    it("returns false for dashboard", () => {
      expect(isPublicRoute("/dashboard")).toBe(false);
    });

    it("returns false for protected routes", () => {
      expect(isPublicRoute("/users")).toBe(false);
      expect(isPublicRoute("/cases")).toBe(false);
    });
  });

  describe("isLoginRoute", () => {
    it("identifies login route", () => {
      expect(isLoginRoute("/login")).toBe(true);
      expect(isLoginRoute("/login/")).toBe(true);
    });

    it("rejects non-login routes", () => {
      expect(isLoginRoute("/dashboard")).toBe(false);
      expect(isLoginRoute("/")).toBe(false);
    });
  });

  describe("isPasswordChangeRoute", () => {
    it("identifies password change route", () => {
      expect(isPasswordChangeRoute("/force-password-change")).toBe(true);
    });

    it("rejects other routes", () => {
      expect(isPasswordChangeRoute("/login")).toBe(false);
      expect(isPasswordChangeRoute("/dashboard")).toBe(false);
    });
  });

  describe("isTwoFactorFlowRoute", () => {
    it("identifies 2FA setup route", () => {
      expect(isTwoFactorFlowRoute("/setup-2fa")).toBe(true);
    });

    it("identifies 2FA verify route", () => {
      expect(isTwoFactorFlowRoute("/verify-2fa")).toBe(true);
    });

    it("identifies password change as part of 2FA flow", () => {
      expect(isTwoFactorFlowRoute("/force-password-change")).toBe(true);
    });

    it("rejects normal routes", () => {
      expect(isTwoFactorFlowRoute("/dashboard")).toBe(false);
      expect(isTwoFactorFlowRoute("/login")).toBe(false);
    });
  });

  describe("isAuthRoute", () => {
    it("includes login routes", () => {
      expect(isAuthRoute("/login")).toBe(true);
    });

    it("includes 2FA routes", () => {
      expect(isAuthRoute("/setup-2fa")).toBe(true);
      expect(isAuthRoute("/verify-2fa")).toBe(true);
    });

    it("includes password change", () => {
      expect(isAuthRoute("/force-password-change")).toBe(true);
    });

    it("excludes dashboard routes", () => {
      expect(isAuthRoute("/dashboard")).toBe(false);
      expect(isAuthRoute("/cases")).toBe(false);
    });
  });

  describe("isMaintenanceRoute", () => {
    it("identifies maintenance route", () => {
      expect(isMaintenanceRoute("/maintenance")).toBe(true);
    });

    it("rejects other routes", () => {
      expect(isMaintenanceRoute("/dashboard")).toBe(false);
    });
  });
});

describe("RBAC Role Access Control", () => {
  describe("getHomeRoute", () => {
    it("returns /executive for MANAGEMENT role", () => {
      expect(getHomeRoute("MANAGEMENT")).toBe("/executive");
    });

    it("returns /engineering for ENGINEER role", () => {
      expect(getHomeRoute("ENGINEER")).toBe("/engineering");
    });

    it("returns /dashboard for SUPER_ADMIN role", () => {
      expect(getHomeRoute("SUPER_ADMIN")).toBe("/dashboard");
    });

    it("returns /dashboard for CS_AGENT role", () => {
      expect(getHomeRoute("CS_AGENT")).toBe("/dashboard");
    });
  });

  describe("canAccessRoute - SUPER_ADMIN", () => {
    const role = "SUPER_ADMIN" as const;

    it("can access dashboard", () => {
      expect(canAccessRoute(role, "/dashboard")).toBe(true);
    });

    it("can access executive", () => {
      expect(canAccessRoute(role, "/executive")).toBe(true);
    });

    it("can access cases", () => {
      expect(canAccessRoute(role, "/cases")).toBe(true);
    });

    it("can access units and subpaths", () => {
      expect(canAccessRoute(role, "/units")).toBe(true);
      expect(canAccessRoute(role, "/units/123")).toBe(true);
    });

    it("can access users", () => {
      expect(canAccessRoute(role, "/users")).toBe(true);
    });

    it("can access imports", () => {
      expect(canAccessRoute(role, "/imports")).toBe(true);
    });

    it("can access audit-logs", () => {
      expect(canAccessRoute(role, "/audit-logs")).toBe(true);
    });

    it("can access backups", () => {
      expect(canAccessRoute(role, "/backups")).toBe(true);
    });

    it("can access system", () => {
      expect(canAccessRoute(role, "/system")).toBe(true);
      expect(canAccessRoute(role, "/system/settings")).toBe(true);
    });

    it("cannot access engineering (ENGINEER only)", () => {
      expect(canAccessRoute(role, "/engineering")).toBe(false);
    });
  });

  describe("canAccessRoute - MANAGEMENT", () => {
    const role = "MANAGEMENT" as const;

    it("can access executive", () => {
      expect(canAccessRoute(role, "/executive")).toBe(true);
    });

    it("can access dashboard", () => {
      expect(canAccessRoute(role, "/dashboard")).toBe(true);
    });

    it("can access cases", () => {
      expect(canAccessRoute(role, "/cases")).toBe(true);
    });

    it("can access units", () => {
      expect(canAccessRoute(role, "/units")).toBe(true);
    });

    it("can access users", () => {
      expect(canAccessRoute(role, "/users")).toBe(true);
    });

    it("cannot access imports", () => {
      expect(canAccessRoute(role, "/imports")).toBe(false);
    });

    it("cannot access audit-logs", () => {
      expect(canAccessRoute(role, "/audit-logs")).toBe(false);
    });

    it("cannot access backups", () => {
      expect(canAccessRoute(role, "/backups")).toBe(false);
    });

    it("cannot access system", () => {
      expect(canAccessRoute(role, "/system")).toBe(false);
    });
  });

  describe("canAccessRoute - CS_AGENT", () => {
    const role = "CS_AGENT" as const;

    it("can access dashboard", () => {
      expect(canAccessRoute(role, "/dashboard")).toBe(true);
    });

    it("can access cases", () => {
      expect(canAccessRoute(role, "/cases")).toBe(true);
    });

    it("can access units", () => {
      expect(canAccessRoute(role, "/units")).toBe(true);
    });

    it("cannot access executive", () => {
      expect(canAccessRoute(role, "/executive")).toBe(false);
    });

    it("cannot access users", () => {
      expect(canAccessRoute(role, "/users")).toBe(false);
    });

    it("cannot access admin routes", () => {
      expect(canAccessRoute(role, "/imports")).toBe(false);
      expect(canAccessRoute(role, "/audit-logs")).toBe(false);
      expect(canAccessRoute(role, "/backups")).toBe(false);
      expect(canAccessRoute(role, "/system")).toBe(false);
    });
  });

  describe("canAccessRoute - ENGINEER", () => {
    const role = "ENGINEER" as const;

    it("can access engineering", () => {
      expect(canAccessRoute(role, "/engineering")).toBe(true);
      expect(canAccessRoute(role, "/engineering/units/123")).toBe(true);
    });

    it("cannot access any other routes", () => {
      expect(canAccessRoute(role, "/dashboard")).toBe(false);
      expect(canAccessRoute(role, "/cases")).toBe(false);
      expect(canAccessRoute(role, "/units")).toBe(false);
      expect(canAccessRoute(role, "/executive")).toBe(false);
      expect(canAccessRoute(role, "/users")).toBe(false);
    });
  });
});

describe("RBAC Navigation Items", () => {
  describe("getCoreNavItems", () => {
    it("returns engineering item only for ENGINEER", () => {
      const items = getCoreNavItems("ENGINEER");
      expect(items).toHaveLength(1);
      expect(items[0].href).toBe("/engineering");
    });

    it("returns executive and dashboard items for SUPER_ADMIN", () => {
      const items = getCoreNavItems("SUPER_ADMIN");
      const hrefs = items.map((i) => i.href);
      expect(hrefs).toContain("/executive");
      expect(hrefs).toContain("/dashboard");
    });

    it("returns executive but not dashboard for MANAGEMENT", () => {
      const items = getCoreNavItems("MANAGEMENT");
      const hrefs = items.map((i) => i.href);
      expect(hrefs).toContain("/executive");
      expect(hrefs).not.toContain("/dashboard");
    });

    it("returns dashboard but not executive for CS_AGENT", () => {
      const items = getCoreNavItems("CS_AGENT");
      const hrefs = items.map((i) => i.href);
      expect(hrefs).toContain("/dashboard");
      expect(hrefs).not.toContain("/executive");
    });
  });

  describe("getNavItems", () => {
    it("returns engineering only for ENGINEER", () => {
      const items = getNavItems("ENGINEER");
      expect(items).toHaveLength(1);
      expect(items[0].key).toBe("engineering");
    });

    it("includes admin items for SUPER_ADMIN", () => {
      const items = getNavItems("SUPER_ADMIN");
      const keys = items.map((i) => i.key);
      expect(keys).toContain("imports");
      expect(keys).toContain("auditLogs");
      expect(keys).toContain("backups");
      expect(keys).toContain("system");
    });

    it("excludes admin items for MANAGEMENT", () => {
      const items = getNavItems("MANAGEMENT");
      const keys = items.map((i) => i.key);
      expect(keys).not.toContain("imports");
      expect(keys).not.toContain("auditLogs");
      expect(keys).not.toContain("backups");
      expect(keys).not.toContain("system");
    });
  });
});
