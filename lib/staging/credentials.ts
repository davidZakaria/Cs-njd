/**
 * Known staging / E2E credentials (fake data only — never use in production).
 * Must stay in sync with `scripts/seed-staging-fake-data.ts`.
 */
export const STAGING_TOTP_SECRET = "JBSWY3DPEHPK3PXP";

export const STAGING_PASSWORD = "StagingTest12!";

export const STAGING_E2E_DUAL_UNIT_CODE = "STAGING-E2E-GA-DUAL-01";

export type StagingRoleKey =
  | "superAdmin"
  | "csAgent"
  | "supervisor"
  | "management"
  | "community";

export const STAGING_USERS: Record<
  StagingRoleKey,
  { email: string; name: string; role: string }
> = {
  superAdmin: {
    email: "staging-superadmin@njd.staging",
    name: "Staging Super Admin",
    role: "SUPER_ADMIN",
  },
  csAgent: {
    email: "staging-cs@njd.staging",
    name: "Staging CS Agent",
    role: "CS_AGENT",
  },
  supervisor: {
    email: "staging-supervisor@njd.staging",
    name: "Staging Supervisor",
    role: "MANAGEMENT",
  },
  management: {
    email: "staging-management@njd.staging",
    name: "Staging Management",
    role: "MANAGEMENT",
  },
  community: {
    email: "staging-community@njd.staging",
    name: "Staging Community",
    role: "COMMUNITY_MANAGEMENT",
  },
};