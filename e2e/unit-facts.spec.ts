import { expect, test } from "@playwright/test";

import { STAGING_E2E_DUAL_UNIT_CODE } from "../lib/staging/credentials";
import { loginAsStagingRole } from "./helpers/auth";

test("unit detail shows key CS legal facts", async ({ page }) => {
  await loginAsStagingRole(page, "csAgent", "en");
  await page.goto("/en/units");
  await page.getByPlaceholder(/search/i).fill(STAGING_E2E_DUAL_UNIT_CODE);
  await page.getByRole("link", { name: STAGING_E2E_DUAL_UNIT_CODE }).first().click();
  await expect(page.getByText(STAGING_E2E_DUAL_UNIT_CODE)).toBeVisible();
  await page.getByRole("tab", { name: /Legal \/ Handover|قانوني/i }).click();
  await expect(page.getByText(/Handover status|حالة التسليم/i)).toBeVisible();
  await expect(page.getByLabel(/Contract date|تاريخ العقد/i)).toBeVisible();
  await expect(page.getByLabel(/Delivery date|تاريخ التسليم/i)).toBeVisible();
});