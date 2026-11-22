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

// Unit/request IDs from seed (production-realistic shapes)
const MERGED_UNIT_ID = 'cmwr4c9d70005jsw60e54idgf';
const LEGACY_COOWNER_UNIT_ID = 'cmwr4c9di000djsw68w3502cg';
const UC_ONLY_UNIT_ID = 'cmwr4c9ds000njsw6rsl8kwaj';
const MULTI_VAR_UNIT_ID = 'cmwr4c9e5000zjsw66d64q60d';
const HANDOVER_REQUEST_ID = 'cmwr4c9ek001jjsw626zq0bca';
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
    
    // Case 1: Merged "/" owner name
    console.log('\nCase 1: Merged "/" owner name...');
    await desktopPage.goto(`${BASE_URL}/en/units/${MERGED_UNIT_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, '01-merged-owner-name-en');
    
    // Case 2: Legacy client + CO_OWNER
    console.log('\nCase 2: Legacy client + CO_OWNER...');
    await desktopPage.goto(`${BASE_URL}/en/units/${LEGACY_COOWNER_UNIT_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, '02-legacy-plus-coowner-en');
    
    // Case 3: Two unitClients, no legacy
    console.log('\nCase 3: Two unitClients, no legacy...');
    await desktopPage.goto(`${BASE_URL}/en/units/${UC_ONLY_UNIT_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, '03-two-unitclients-en');
    
    // Check for multi-unit badge (B5-30 owns B5-31)
    console.log('\nChecking multi-unit badge...');
    const badge = desktopPage.locator('[data-slot="tooltip-trigger"]').first();
    if (await badge.isVisible()) {
      await badge.hover({ force: true });
      await desktopPage.waitForTimeout(600);
      await screenshot(desktopPage, '04-multi-unit-badge-tooltip-en');
    }
    
    // Case 4: Multi-unit with spelling variations
    console.log('\nCase 4: Multi-unit with spelling variations...');
    await desktopPage.goto(`${BASE_URL}/en/units/${MULTI_VAR_UNIT_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, '05-multi-unit-spelling-var-en');
    
    // Handover request
    console.log('\nHandover request...');
    await desktopPage.goto(`${BASE_URL}/en/requests/${HANDOVER_REQUEST_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, '06-handover-request-en');
    
    // Delete flow
    console.log('\nDelete flow...');
    await desktopPage.goto(`${BASE_URL}/en/requests/${DELETE_REQUEST_ID}`);
    await desktopPage.waitForTimeout(2000);
    await screenshot(desktopPage, '07-delete-request-before-en');
    
    const deleteBtn = desktopPage.locator('button:has-text("Delete request")');
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await desktopPage.waitForTimeout(500);
      await screenshot(desktopPage, '08-delete-dialog-en');
      await desktopPage.keyboard.press('Escape');
    }
    
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
    
    // Case 1: Merged "/" owner name (Arabic)
    console.log('\nCase 1: Merged "/" owner name (Arabic)...');
    await arabicPage.goto(`${BASE_URL}/ar/units/${MERGED_UNIT_ID}`);
    await arabicPage.waitForTimeout(2000);
    await screenshot(arabicPage, '09-merged-owner-name-ar');
    
    // Case 3: Two unitClients (Arabic)
    console.log('\nCase 3: Two unitClients (Arabic)...');
    await arabicPage.goto(`${BASE_URL}/ar/units/${UC_ONLY_UNIT_ID}`);
    await arabicPage.waitForTimeout(2000);
    await screenshot(arabicPage, '10-two-unitclients-ar');
    
    await arabicContext.close();
    
    // ============================================================
    // NARROW/MOBILE SCREENSHOTS
    // ============================================================
    console.log('\n=== Narrow/Mobile Screenshots ===');
    const narrowContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      locale: 'en-US',
    });
    const narrowPage = await narrowContext.newPage();
    await login(narrowPage, 'en');
    
    console.log('\nMerged owner name (narrow)...');
    await narrowPage.goto(`${BASE_URL}/en/units/${MERGED_UNIT_ID}`);
    await narrowPage.waitForTimeout(2000);
    await screenshot(narrowPage, '11-merged-owner-name-narrow');
    
    await narrowContext.close();
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
