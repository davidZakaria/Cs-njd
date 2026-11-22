/**
 * Staging / E2E identities and fixture unit codes (fake data only).
 * Passwords and TOTP: use resolveStagingPassword() / resolveStagingTotpSecret().
 */

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

/** Clean dual owners — two UnitClient rows (PRIMARY + CO_OWNER). */
export const STAGING_E2E_DUAL_UNIT_CODE = "STAGING-E2E-GA-DUAL-01";

/** Merged Arabic names in one client.name with "/", legacy primary block only. */
export const STAGING_E2E_MERGED_SLASH_UNIT_CODE = "STAGING-E2E-MERGED-SLASH-01";

/** unit.clientId legacy primary plus CO_OWNER link added later. */
export const STAGING_E2E_LEGACY_COOWNER_UNIT_CODE = "STAGING-E2E-LEGACY-COOWNER-01";

/** Same as dual — explicit alias for E2E naming. */
export const STAGING_E2E_TWO_UNIT_CLIENTS_CODE = STAGING_E2E_DUAL_UNIT_CODE;

export const STAGING_E2E_OWNER_SHAPE_UNITS = {
  mergedSlash: STAGING_E2E_MERGED_SLASH_UNIT_CODE,
  legacyCoOwner: STAGING_E2E_LEGACY_COOWNER_UNIT_CODE,
  twoUnitClients: STAGING_E2E_TWO_UNIT_CLIENTS_CODE,
} as const;