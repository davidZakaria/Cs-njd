/**
 * Screenshot script for PR documentation
 * Uses Playwright to capture all required screenshots
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { authenticator } from 'otplib';

const SCREENSHOTS_DIR = '/opt/cursor/artifacts';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Clear old screenshots
for (const f of fs.readdirSync(SCREENSHOTS_DIR)) {
  if (f.endsWith('.png')) {
    fs.unlinkSync(path.join(SCREENSHOTS_DIR, f));
  }
}

const BASE_URL = 'http://localhost:3000';

// Test users with known TOTP secret
const TEST_USER_EMAIL = 'demo-mgmt@test.local';
const TEST_USER_PASSWORD = 'TestPassword1234!';
const TEST_USER_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

// Unit/request IDs from seed
const MULTI_UNIT_ID = 'cmwr32sng0001jsnh6vmyolw6';
const TWO_OWNER_UNIT_ID = 'cmwr333zy000jjsqb6p8w5v3z';
const HANDOVER_REQUEST_ID = 'cmwr33405000tjsqbfqjnufeu';
const DELETE_REQUEST_ID = 'cmwr3340i0018jsqbro9j20a6';

async function login(page, locale = 'en') {
  console.log(`  Logging in (${locale})...`);
  await page.goto(`${BASE_URL}/${locale}/login`);
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  await page.fill('input[name="email"]', TEST_USER_EMAIL);
  await page.fill('input[name="password"]', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(2000);
  let url = page.url();
  
  if (url.includes('verify-2fa')) {
    console.log('  2FA verification required, generating code...');
    const totpCode = authenticator.generate(TEST_USER_TOTP_SECRET);
    console.log(`  Using TOTP code: ${totpCode}`);
    
    await page.waitForSelector('input#token', { timeout: 10000 });
    const codeInput = page.locator('input#token');
    await codeInput.fill(totpCode);
    
    const verifyBtn = page.locator('button[type="submit"]');
    await verifyBtn.click();
    
    await page.waitForTimeout(3000);
    url = page.url();
  }
  
  if (url.includes('setup-2fa')) {
    throw new Error('User needs 2FA setup - run seed script again');
  }
  
  console.log('  Login successful, URL:', url);
  return true;
}

async function screenshot(page, name, fullPage = false) {
  const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage });
  console.log(`  Saved: ${name}.png`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  const desktopPage = await desktopContext.newPage();

  try {
    // ============================================================
    // ENGLISH DESKTOP SCREENSHOTS
    // ============================================================
    console.log('\n=== English Desktop Screenshots ===');
    await login(desktopPage, 'en');
    
    // 1. Units List showing multi-unit badge
    console.log('\nCapturing Units List (EN desktop)...');
    await desktopPage.goto(`${BASE_URL}/en/units`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, '01-units-list-en');
    
    // 2. CS Summary Header on MULTI-001 unit
    console.log('\nCapturing CS Summary Header for MULTI-001 (EN desktop)...');
    await desktopPage.goto(`${BASE_URL}/en/units/${MULTI_UNIT_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, '02-cs-summary-header-multi-unit-en');
    
    // 3. Hover on badge to show tooltip
    console.log('\nCapturing Multi-unit Badge tooltip...');
    const tooltipTrigger = desktopPage.locator('[data-slot="tooltip-trigger"]').first();
    if (await tooltipTrigger.isVisible()) {
      await tooltipTrigger.hover({ force: true });
      await desktopPage.waitForTimeout(600);
      await screenshot(desktopPage, '03-multi-unit-badge-tooltip-en');
    } else {
      console.log('  Tooltip trigger not found, skipping tooltip screenshot');
    }
    
    // 4. Two-owner unit page
    console.log('\nCapturing Two-owner unit page (EN desktop)...');
    await desktopPage.goto(`${BASE_URL}/en/units/${TWO_OWNER_UNIT_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, '04-two-owner-unit-en');
    
    // 5. Requests list showing resolved client names
    console.log('\nCapturing Requests List (EN desktop)...');
    await desktopPage.goto(`${BASE_URL}/en/requests`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, '05-requests-list-en');
    
    // 6. Handover request detail
    console.log('\nCapturing Handover request (EN desktop)...');
    await desktopPage.goto(`${BASE_URL}/en/requests/${HANDOVER_REQUEST_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, '06-handover-request-en');
    
    // 7. Delete flow - before state
    console.log('\nCapturing Delete flow (EN desktop)...');
    await desktopPage.goto(`${BASE_URL}/en/requests/${DELETE_REQUEST_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, '07-delete-request-before-en');
    
    // 8. Click delete button and capture dialog
    const deleteBtn = desktopPage.locator('button:has-text("Delete request")');
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await desktopPage.waitForTimeout(500);
      await screenshot(desktopPage, '08-delete-dialog-en');
      
      // Type reason
      const reasonInput = desktopPage.locator('textarea#delete-reason');
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('Test deletion for demonstration purposes');
        await screenshot(desktopPage, '09-delete-dialog-with-reason-en');
      }
      
      await desktopPage.keyboard.press('Escape');
    } else {
      console.log('  Delete button not found');
    }
    
    // ============================================================
    // ENGLISH NARROW SCREENSHOTS (Mobile)
    // ============================================================
    console.log('\n=== English Narrow (Mobile) Screenshots ===');
    const narrowContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      locale: 'en-US',
    });
    const narrowPage = await narrowContext.newPage();
    await login(narrowPage, 'en');
    
    console.log('\nCapturing CS Summary Header (EN narrow)...');
    await narrowPage.goto(`${BASE_URL}/en/units/${MULTI_UNIT_ID}`);
    await narrowPage.waitForTimeout(2000);
    await screenshot(narrowPage, '10-cs-summary-header-narrow-en');
    await narrowContext.close();
    
    // ============================================================
    // ARABIC DESKTOP SCREENSHOTS (RTL)
    // ============================================================
    console.log('\n=== Arabic Desktop Screenshots (RTL) ===');
    const arabicContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: 'ar-EG',
    });
    const arabicPage = await arabicContext.newPage();
    await login(arabicPage, 'ar');
    
    // 11. Units list (Arabic)
    console.log('\nCapturing Units List (AR desktop)...');
    await arabicPage.goto(`${BASE_URL}/ar/units`);
    await arabicPage.waitForTimeout(2000);
    await screenshot(arabicPage, '11-units-list-ar');
    
    // 12. CS Summary Header (Arabic RTL)
    console.log('\nCapturing CS Summary Header (AR desktop)...');
    await arabicPage.goto(`${BASE_URL}/ar/units/${MULTI_UNIT_ID}`);
    await arabicPage.waitForTimeout(2000);
    await screenshot(arabicPage, '12-cs-summary-header-multi-unit-ar');
    
    // 13. Requests list (Arabic)
    console.log('\nCapturing Requests List (AR desktop)...');
    await arabicPage.goto(`${BASE_URL}/ar/requests`);
    await arabicPage.waitForTimeout(2000);
    await screenshot(arabicPage, '13-requests-list-ar');
    
    // 14. Delete dialog (Arabic)
    console.log('\nCapturing Delete dialog (AR)...');
    await arabicPage.goto(`${BASE_URL}/ar/requests/${DELETE_REQUEST_ID}`);
    await arabicPage.waitForTimeout(2000);
    
    const deleteBtnAr = arabicPage.locator('button:has-text("حذف")');
    if (await deleteBtnAr.isVisible()) {
      await deleteBtnAr.click();
      await arabicPage.waitForTimeout(500);
      await screenshot(arabicPage, '14-delete-dialog-ar');
      await arabicPage.keyboard.press('Escape');
    }
    
    await arabicContext.close();
    
    // ============================================================
    // ARABIC NARROW SCREENSHOTS
    // ============================================================
    console.log('\n=== Arabic Narrow (Mobile) Screenshots ===');
    const arabicNarrowContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      locale: 'ar-EG',
    });
    const arabicNarrowPage = await arabicNarrowContext.newPage();
    await login(arabicNarrowPage, 'ar');
    
    console.log('\nCapturing CS Summary Header (AR narrow)...');
    await arabicNarrowPage.goto(`${BASE_URL}/ar/units/${MULTI_UNIT_ID}`);
    await arabicNarrowPage.waitForTimeout(2000);
    await screenshot(arabicNarrowPage, '15-cs-summary-header-narrow-ar');
    
    await arabicNarrowContext.close();
    await desktopContext.close();
    
  } catch (error) {
    console.error('Screenshot error:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('\n=== All Screenshots Complete ===');
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
  
  // List all screenshots
  const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
  console.log(`\nGenerated ${files.length} screenshots:`);
  files.sort().forEach(f => console.log(`  - ${f}`));
}

main().catch(console.error);
