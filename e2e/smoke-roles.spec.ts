import { expect, test } from "@playwright/test";

import { loginAsStagingRole } from "./helpers/auth";
import type { StagingRoleKey } from "../lib/staging/credentials";

const ROLES: StagingRoleKey[] = [
  "csAgent",
  "supervisor",
  "management",
  "community",
  "superAdmin",
];

for (const role of ROLES) {
  test(`sign in as ${role}`, async ({ page }) => {
    await loginAsStagingRole(page, role, "en");
    await expect(page).toHaveURL(/\/(dashboard|executive|units|operations)/);
  });
}