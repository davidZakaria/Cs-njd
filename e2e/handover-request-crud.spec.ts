import { expect, test } from "@playwright/test";

import { STAGING_E2E_DUAL_UNIT_CODE } from "../lib/staging/credentials";
import { loginAsStagingRole } from "./helpers/auth";

test("create, edit, and cancel handover request on dual-owner unit", async ({
  page,
}) => {
  await loginAsStagingRole(page, "csAgent", "en");
  await page.goto("/en/requests");

  await page.getByRole("combobox").first().click();
  await page
    .getByPlaceholder(/Search unit code|ابحث عن/i)
    .fill(STAGING_E2E_DUAL_UNIT_CODE);
  await page
    .getByRole("option", { name: new RegExp(STAGING_E2E_DUAL_UNIT_CODE) })
    .click();

  const typeSelect = page
    .locator("label", { hasText: /Request type|نوع الطلب/i })
    .locator("..")
    .getByRole("combobox");
  await typeSelect.click();
  await page
    .getByRole("option", { name: /Handover appointment|موعد تسليم/i })
    .click();

  const marker = `E2E handover ${Date.now()}`;
  await page.locator("textarea").first().fill(marker);
  await page.getByRole("button", { name: /Create draft|إنشاء مسودة/i }).click();

  await page.waitForURL(/\/requests\/[a-z0-9]+/i, { timeout: 60_000 });
  await expect(page.getByText(marker)).toBeVisible();

  await page.getByRole("button", { name: /^Edit$|^تعديل$/i }).click();
  const updated = `${marker} — edited`;
  await page.locator("textarea").first().fill(updated);
  await page.getByRole("button", { name: /Save|حفظ/i }).click();
  await expect(page.getByText(updated)).toBeVisible();

  await page
    .getByRole("button", { name: /Cancel request|إلغاء الطلب/i })
    .click();
  await expect(page.locator('[data-slot="badge"]').filter({ hasText: /cancelled|ملغى/i })).toBeVisible();
});