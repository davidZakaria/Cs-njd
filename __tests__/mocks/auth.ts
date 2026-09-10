import { vi } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

export type MockSessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  is2FAEnabled?: boolean;
  needs2FASetup?: boolean;
  twoFactorVerified?: boolean;
  requiresPasswordChange?: boolean;
  sessionVersion?: number;
};

export function createMockSession(user: MockSessionUser | null): Session | null {
  if (!user) return null;
  
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is2FAEnabled: user.is2FAEnabled ?? true,
      needs2FASetup: user.needs2FASetup ?? false,
      twoFactorVerified: user.twoFactorVerified ?? true,
      requiresPasswordChange: user.requiresPasswordChange ?? false,
      sessionVersion: user.sessionVersion ?? 1,
    },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  } as Session;
}

export function createMockUsers() {
  return {
    superAdmin: {
      id: "super-admin-id",
      email: "admin@test.com",
      name: "Super Admin",
      role: "SUPER_ADMIN" as Role,
    },
    management: {
      id: "management-id",
      email: "manager@test.com",
      name: "Manager",
      role: "MANAGEMENT" as Role,
    },
    csAgent: {
      id: "cs-agent-id",
      email: "agent@test.com",
      name: "CS Agent",
      role: "CS_AGENT" as Role,
    },
    engineer: {
      id: "engineer-id",
      email: "engineer@test.com",
      name: "Site Engineer",
      role: "ENGINEER" as Role,
    },
  };
}

export const mockAuth = vi.fn<() => Promise<Session | null>>();

export function setupAuthMock(session: Session | null) {
  mockAuth.mockResolvedValue(session);
}
