import { expect, type Page } from "@playwright/test";

/**
 * Create handover appointment draft, edit description, save, and submit for approval.
 */
export async function handoverRequestCreateEditSubmit(
  page: Page,
  unitCode: string,
  marker: string
) {
  await page.goto("/en/requests");

  await page.getByRole("combobox").first().click();
  await page.getByPlaceholder(/Search unit code|ابحث عن/i).fill(unitCode);
  await page
    .getByRole("option", { name: new RegExp(unitCode) })
    .click();

  const typeSelect = page
    .locator("label", { hasText: /Request type|نوع الطلب/i })
    .locator("..")
    .getByRole("combobox");
  await typeSelect.click();
  await page
    .getByRole("option", { name: /Handover appointment|موعد تسليم/i })
    .click();

  await page.locator("textarea").first().fill(marker);
  await page.getByRole("button", { name: /Create draft|إنشاء مسودة/i }).click();
  await page.waitForURL(/\/requests\/[a-z0-9]+/i, { timeout: 60_000 });
  await expect(page.getByText(marker)).toBeVisible();

  await page.getByRole("button", { name: /^Edit$|^تعديل$/i }).click();
  const updated = `${marker} — saved`;
  await page.locator("textarea").first().fill(updated);
  await page.getByRole("button", { name: /^Save$|^حفظ$/i }).click();
  await expect(page.getByText(updated)).toBeVisible();

  await page
    .getByRole("button", { name: /Submit for approval|إرسال للموافقة/i })
    .click();
  await expect(
    page.locator('[data-slot="badge"]').filter({ hasText: /Pending|قيد/i })
  ).toBeVisible({ timeout: 30_000 });

  return updated;
}

/** Save primary owner unit profile fields (grace / contract price) on Client tab. */
export async function savePrimaryOwnerProfileFields(
  page: Page,
  unitCode: string,
  input: { gracePeriod?: string; contractPricePerMeter?: string }
) {
  await page.goto("/en/units");
  await page.getByPlaceholder(/search/i).fill(unitCode);
  await page.getByRole("link", { name: unitCode }).first().click();
  await page.getByRole("tab", { name: /Client|العميل/i }).click();

  if (input.gracePeriod != null) {
    await page.locator("#gracePeriod").fill(input.gracePeriod);
  }
  if (input.contractPricePerMeter != null) {
    await page.locator("#contractPricePerMeter").fill(input.contractPricePerMeter);
  }

  const primaryForm = page
    .locator("form")
    .filter({ has: page.locator("#gracePeriod") })
    .first();
  await primaryForm.getByRole("button", { name: /^Save$|^حفظ$/i }).click();
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
}