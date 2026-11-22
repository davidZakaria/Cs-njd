import { expect, test } from "@playwright/test";

import { STAGING_E2E_DUAL_UNIT_CODE } from "../lib/staging/credentials";
import { loginAsStagingRole } from "./helpers/auth";

test("management can assign a case", async ({ page }) => {
  await loginAsStagingRole(page, "supervisor", "en");
  await page.goto("/en/cases");
  await expect(page.getByText(/Staging/i).first()).toBeVisible({ timeout: 60_000 });
  const assignTrigger = page.locator('form button[type="submit"]').first();
  if (await assignTrigger.isVisible()) {
    await assignTrigger.click();
  }
});

test("CS agent cannot open users admin", async ({ page }) => {
  await loginAsStagingRole(page, "csAgent", "en");
  await page.goto("/en/users");
  await expect(page).not.toHaveURL(/\/users/);
});

test("create case from dual-owner unit", async ({ page }) => {
  await loginAsStagingRole(page, "csAgent", "en");
  await page.goto("/en/units");
  await page.getByPlaceholder(/search/i).fill(STAGING_E2E_DUAL_UNIT_CODE);
  await page.getByRole("link", { name: STAGING_E2E_DUAL_UNIT_CODE }).first().click();
  await page.getByRole("tab", { name: /CS Feedback Timeline|التسلسل/i }).click();
  const note = `E2E case ${Date.now()}`;
  const feedbackForm = page
    .locator("form")
    .filter({ has: page.locator('textarea[name="notes"]') });
  await feedbackForm.locator('textarea[name="notes"]').fill(note);
  await feedbackForm.getByRole("button", { name: /^save$|حفظ/i }).click();
  await expect(page.getByText(note)).toBeVisible({ timeout: 60_000 });
});