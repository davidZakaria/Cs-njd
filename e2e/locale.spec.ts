import { expect, test } from "@playwright/test";

import { loginAsStagingRole } from "./helpers/auth";

test("switch English to Arabic", async ({ page }) => {
  await loginAsStagingRole(page, "csAgent", "en");
  await expect(page).toHaveURL(/\/en\//);
  await page.getByRole("button", { name: /language|اللغة/i }).click();
  await page.getByRole("menuitem", { name: /arabic|العربية/i }).click();
  await expect(page).toHaveURL(/\/ar\//);
  await expect(page.getByText(/لوحة|الوحدات|التسليم/).first()).toBeVisible();
});