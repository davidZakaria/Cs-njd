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

const BASE_URL = 'http://localhost:3000';

// Test users with known TOTP secret (from seed-screenshot-data.ts)
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
  
  // Wait for redirect
  await page.waitForTimeout(2000);
  let url = page.url();
  
  // Handle 2FA verification if required
  if (url.includes('verify-2fa')) {
    console.log('  2FA verification required, generating code...');
    const totpCode = authenticator.generate(TEST_USER_TOTP_SECRET);
    console.log(`  Using TOTP code: ${totpCode}`);
    
    // Wait for the token input to appear
    await page.waitForSelector('input#token', { timeout: 10000 });
    
    // Fill in the 2FA code
    const codeInput = page.locator('input#token');
    await codeInput.fill(totpCode);
    
    // Submit the form
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
  
  // Desktop viewport
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  const desktopPage = await desktopContext.newPage();
  
  // Narrow viewport (mobile-like)
  const narrowContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    locale: 'en-US',
  });
  const narrowPage = await narrowContext.newPage();

  try {
    // ============================================================
    // ENGLISH DESKTOP SCREENSHOTS
    // ============================================================
    console.log('\n=== English Desktop Screenshots ===');
    await login(desktopPage, 'en');
    
    // CS Summary Header + Multi-unit Badge (desktop)
    console.log('\nCapturing CS Summary Header (EN desktop)...');
    await desktopPage.goto(`${BASE_URL}/en/units/${MULTI_UNIT_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, 'cs-summary-header-en-desktop');
    
    // Multi-unit badge tooltip
    console.log('\nCapturing Multi-unit Badge tooltip (EN)...');
    const badgeBtn = desktopPage.locator('[data-slot="tooltip-trigger"]').first();
    if (await badgeBtn.isVisible()) {
      await badgeBtn.hover();
      await desktopPage.waitForTimeout(500);
      await screenshot(desktopPage, 'multi-unit-badge-tooltip-en');
    } else {
      console.log('  Badge not visible, checking for crown icon...');
      const crown = desktopPage.locator('svg.lucide-crown').first();
      if (await crown.isVisible()) {
        await crown.hover();
        await desktopPage.waitForTimeout(500);
        await screenshot(desktopPage, 'multi-unit-badge-tooltip-en');
      }
    }
    
    // Two-owner unit CS summary
    console.log('\nCapturing Two-owner unit page (EN desktop)...');
    await desktopPage.goto(`${BASE_URL}/en/units/${TWO_OWNER_UNIT_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, 'two-owner-unit-en-desktop');
    
    // Handover request detail (for edit demo)
    console.log('\nCapturing Handover request (EN desktop)...');
    await desktopPage.goto(`${BASE_URL}/en/requests/${HANDOVER_REQUEST_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, 'handover-request-en-desktop');
    
    // Delete request flow
    console.log('\nCapturing Delete flow (EN desktop)...');
    await desktopPage.goto(`${BASE_URL}/en/requests/${DELETE_REQUEST_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, 'delete-request-before-en');
    
    // Click delete button
    const deleteBtn = desktopPage.locator('button:has-text("Delete request")');
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await desktopPage.waitForTimeout(500);
      await screenshot(desktopPage, 'delete-dialog-en');
      
      // Type reason
      const reasonInput = desktopPage.locator('textarea#delete-reason');
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('Test deletion for demonstration purposes');
        await screenshot(desktopPage, 'delete-dialog-with-reason-en');
      }
      
      // Cancel to not actually delete
      await desktopPage.keyboard.press('Escape');
    } else {
      console.log('  Delete button not found');
    }
    
    // ============================================================
    // ENGLISH NARROW SCREENSHOTS
    // ============================================================
    console.log('\n=== English Narrow (Mobile) Screenshots ===');
    await login(narrowPage, 'en');
    
    console.log('\nCapturing CS Summary Header (EN narrow)...');
    await narrowPage.goto(`${BASE_URL}/en/units/${MULTI_UNIT_ID}`);
    await narrowPage.waitForTimeout(2000);
    await screenshot(narrowPage, 'cs-summary-header-en-narrow');
    
    // ============================================================
    // ARABIC DESKTOP SCREENSHOTS (RTL)
    // ============================================================
    console.log('\n=== Arabic Desktop Screenshots (RTL) ===');
    
    // Create Arabic context
    const arabicContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: 'ar-EG',
    });
    const arabicPage = await arabicContext.newPage();
    await login(arabicPage, 'ar');
    
    // CS Summary Header (Arabic RTL)
    console.log('\nCapturing CS Summary Header (AR desktop)...');
    await arabicPage.goto(`${BASE_URL}/ar/units/${MULTI_UNIT_ID}`);
    await arabicPage.waitForTimeout(2000);
    await screenshot(arabicPage, 'cs-summary-header-ar-desktop');
    
    // Multi-unit badge tooltip (Arabic)
    console.log('\nCapturing Multi-unit Badge tooltip (AR)...');
    const badgeBtnAr = arabicPage.locator('[data-slot="tooltip-trigger"]').first();
    if (await badgeBtnAr.isVisible()) {
      await badgeBtnAr.hover();
      await arabicPage.waitForTimeout(500);
      await screenshot(arabicPage, 'multi-unit-badge-tooltip-ar');
    }
    
    // Delete dialog (Arabic)
    console.log('\nCapturing Delete dialog (AR)...');
    await arabicPage.goto(`${BASE_URL}/ar/requests/${DELETE_REQUEST_ID}`);
    await arabicPage.waitForTimeout(2000);
    await screenshot(arabicPage, 'delete-request-before-ar');
    
    const deleteBtnAr = arabicPage.locator('button:has-text("حذف الطلب")');
    if (await deleteBtnAr.isVisible()) {
      await deleteBtnAr.click();
      await arabicPage.waitForTimeout(500);
      await screenshot(arabicPage, 'delete-dialog-ar');
      await arabicPage.keyboard.press('Escape');
    }
    
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
    await screenshot(arabicNarrowPage, 'cs-summary-header-ar-narrow');
    
    // ============================================================
    // CLOSE CONTEXTS
    // ============================================================
    await desktopContext.close();
    await narrowContext.close();
    await arabicContext.close();
    await arabicNarrowContext.close();
    
  } catch (error) {
    console.error('Screenshot error:', error);
    // Take error screenshot
    await desktopPage.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, 'error-state.png'),
      fullPage: true 
    });
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('\n=== All Screenshots Complete ===');
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
}

main().catch(console.error);
