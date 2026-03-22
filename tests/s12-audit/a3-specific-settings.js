const { chromium } = require('playwright');
const path = require('path');

const BASE = 'https://unmissed-ai-production.up.railway.app';
const SCREENSHOTS = '/Users/owner/Downloads/CALLING AGENTs/docs/s12-audit/screenshots';

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: true });
  console.log(`  [screenshot] ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', 'admin@unmissed.ai');
  await page.fill('input[type="password"]', 'COOLboy1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });

  const clients = [
    { name: 'hasan-sharif', id: '34eb9b6c-852c-4e9e-9239-2e6488736769' },
    { name: 'windshield-hub', id: 'bff9d635-436f-44a6-a84a-5e143fff7c18' },
  ];

  const settingsTabs = ['Agent', 'SMS', 'Voice', 'Alerts', 'Billing', 'Knowledge'];

  for (const client of clients) {
    console.log(`\n=== ${client.name} Settings ===`);

    // Navigate to settings
    await page.goto(`${BASE}/dashboard/settings?client_id=${client.id}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    await screenshot(page, `settings-${client.name}-overview`);

    // Click through each tab
    for (const tabName of settingsTabs) {
      try {
        const tab = await page.$(`button:has-text("${tabName}"), a:has-text("${tabName}")`);
        if (tab) {
          await tab.click();
          await page.waitForTimeout(1500);
          await screenshot(page, `settings-${client.name}-${tabName.toLowerCase()}`);
          console.log(`  [tab] ${tabName} - captured`);
        } else {
          console.log(`  [tab] ${tabName} - NOT FOUND`);
        }
      } catch (e) {
        console.log(`  [tab] ${tabName} - error: ${e.message}`);
      }
    }

    // Also get the setup page with client context
    await page.goto(`${BASE}/dashboard/setup?client_id=${client.id}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Click through the 3 setup steps
    const setupSteps = ['1Phone Setup', '2Agent', '3Context'];
    for (const stepLabel of setupSteps) {
      const stepNum = stepLabel[0];
      try {
        const stepBtn = await page.$(`button:has-text("${stepLabel}")`);
        if (stepBtn) {
          await stepBtn.click();
          await page.waitForTimeout(1500);
          await screenshot(page, `setup-${client.name}-step${stepNum}`);
          console.log(`  [setup-step] ${stepLabel} - captured`);
        }
      } catch (e) {
        console.log(`  [setup-step] ${stepLabel} - error: ${e.message}`);
      }
    }
  }

  // Also check the trial clients (Extreme fade, jane)
  const trialClients = [
    { name: 'extreme-fade', id: '03bebe1b-9c5d-477b-b28b-ad60a63c44e5' },
    { name: 'jane', id: '1086992f-97bb-48e2-96a7-8bd650f11690' },
  ];

  for (const client of trialClients) {
    console.log(`\n=== ${client.name} (TRIAL) Settings ===`);
    await page.goto(`${BASE}/dashboard/settings?client_id=${client.id}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    await screenshot(page, `settings-trial-${client.name}`);

    const pageText = await page.textContent('body');
    console.log(`[${client.name}] Settings text (first 1000): ${pageText.slice(0, 1000)}`);
  }

  await browser.close();
  console.log('\n[DONE] Specific client settings complete');
})();
