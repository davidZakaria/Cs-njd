import { expect, test } from "@playwright/test";

import { STAGING_E2E_OWNER_SHAPE_UNITS } from "../lib/staging/credentials";
import { loginAsStagingRole } from "./helpers/auth";
import { handoverRequestCreateEditSubmit } from "./helpers/handover-request";

const CASES = [
  {
    name: "merged slash client name (legacy primary block)",
    unitCode: STAGING_E2E_OWNER_SHAPE_UNITS.mergedSlash,
  },
  {
    name: "legacy clientId plus CO_OWNER link",
    unitCode: STAGING_E2E_OWNER_SHAPE_UNITS.legacyCoOwner,
  },
  {
    name: "two UnitClient rows (PRIMARY + CO_OWNER)",
    unitCode: STAGING_E2E_OWNER_SHAPE_UNITS.twoUnitClients,
  },
] as const;

for (const scenario of CASES) {
  test(`handover request full flow on ${scenario.name}`, async ({ page }) => {
    await loginAsStagingRole(page, "csAgent", "en");
    const marker = `E2E handover shape ${scenario.unitCode} ${Date.now()}`;
    const saved = await handoverRequestCreateEditSubmit(page, scenario.unitCode, marker);
    await expect(page.getByText(saved)).toBeVisible();
    await page
      .getByRole("button", { name: /Cancel request|إلغاء الطلب/i })
      .click();
    await expect(
      page.locator('[data-slot="badge"]').filter({ hasText: /Cancelled|ملغى/i })
    ).toBeVisible();
  });
}