const { chromium } = require('playwright');
const path = require('path');

const BASE = 'https://unmissed-ai-production.up.railway.app';
const SCREENSHOTS = '/Users/owner/Downloads/CALLING AGENTs/docs/s12-audit/screenshots';
const TRIAL_CLIENT_ID = '229af8c4-4f79-4d50-8448-7e1490f5c66e';

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: true });
  console.log(`  [screenshot] ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login as admin
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', 'admin@unmissed.ai');
  await page.fill('input[type="password"]', 'COOLboy1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  console.log('[login] Admin logged in');

  // Check each dashboard section for the trial client
  const pages = [
    { path: `/dashboard/calls?client_id=${TRIAL_CLIENT_ID}`, name: 'e3-calls' },
    { path: `/dashboard/settings?client_id=${TRIAL_CLIENT_ID}`, name: 'e3-settings-agent' },
    { path: `/dashboard/setup?client_id=${TRIAL_CLIENT_ID}`, name: 'e3-setup' },
    { path: `/dashboard/voices?client_id=${TRIAL_CLIENT_ID}`, name: 'e3-voices' },
    { path: `/dashboard/leads?client_id=${TRIAL_CLIENT_ID}`, name: 'e3-leads' },
    { path: `/dashboard/live?client_id=${TRIAL_CLIENT_ID}`, name: 'e3-live' },
    { path: `/dashboard/lab?client_id=${TRIAL_CLIENT_ID}`, name: 'e3-lab' },
  ];

  for (const pg of pages) {
    console.log(`\n=== ${pg.name} ===`);
    try {
      const resp = await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
      console.log(`  [status] ${resp.status()}`);
      await screenshot(page, pg.name);

      // Get key content
      const mainContent = await page.$eval('main', el => el.textContent.trim().slice(0, 800)).catch(() => '');
      console.log(`  [content] ${mainContent.slice(0, 500)}`);
    } catch (e) {
      console.log(`  [error] ${e.message}`);
    }
  }

  // Check settings tabs for the trial client
  console.log('\n=== Settings tabs for trial client ===');
  await page.goto(`${BASE}/dashboard/settings?client_id=${TRIAL_CLIENT_ID}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  const tabNames = ['Agent', 'SMS', 'Voice', 'Alerts', 'Billing', 'Knowledge'];
  for (const tabName of tabNames) {
    try {
      // Find the exact tab button in the settings page header area
      const tabs = await page.$$('button');
      for (const tab of tabs) {
        const text = await tab.textContent();
        if (text.trim() === tabName) {
          await tab.click();
          await page.waitForTimeout(1500);
          await screenshot(page, `e3-settings-${tabName.toLowerCase()}`);
          console.log(`  [tab] ${tabName} - captured`);

          // Check content
          const tabContent = await page.textContent('main');
          // Look for specific indicators
          if (tabName === 'Agent') {
            const hasPrompt = tabContent.includes('system_prompt') || tabContent.includes('System Prompt') || tabContent.includes('prompt');
            const hasAgentName = tabContent.includes('Agent name') || tabContent.includes('agent_name');
            console.log(`  [agent-tab] Has prompt reference: ${hasPrompt}`);
            console.log(`  [agent-tab] Has agent name: ${hasAgentName}`);
          }
          if (tabName === 'Billing') {
            const hasTrial = tabContent.toLowerCase().includes('trial');
            const hasSubscription = tabContent.toLowerCase().includes('subscription');
            console.log(`  [billing-tab] Has trial: ${hasTrial}, Has subscription: ${hasSubscription}`);
          }
          break;
        }
      }
    } catch (e) {
      console.log(`  [tab] ${tabName} - error: ${e.message}`);
    }
  }

  // Also check what the "Open your Dashboard" link points to
  // The setupUrl from the trial was a recovery token URL
  console.log('\n=== Dashboard access check ===');
  console.log('setupUrl from trial API: https://unmissed-ai-production.up.railway.app/auth/confirm?token_hash=...&type=recovery&next=/dashboard');
  console.log('This is a password recovery link, not a direct login link.');
  console.log('If user clicks "Open your Dashboard", it goes to auth/confirm which should set a session then redirect.');

  // Check the onboard/status page for AdminTestPanel
  console.log('\n=== AdminTestPanel check ===');
  // Find the intake ID for the trial client
  await page.goto(`${BASE}/dashboard/intake`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'e3-intake-page');
  const intakeText = await page.textContent('main');
  console.log(`  [intake] Content: ${intakeText.slice(0, 500)}`);

  // Try the onboard/status page with intake ID
  const intakeId = 'de5f4f7e-30b7-4cbb-9aa4-8e543e7a7367';
  await page.goto(`${BASE}/onboard/status?id=${intakeId}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'e3-admin-test-panel');
  const statusText = await page.textContent('body');
  console.log(`  [admin-test-panel] Content: ${statusText.slice(0, 1000)}`);

  await browser.close();
  console.log('\n[DONE] E3 post-activation check complete');
})();
