const { chromium } = require('playwright');
const path = require('path');

const BASE = 'https://unmissed-ai-production.up.railway.app';
const SCREENSHOTS = '/Users/owner/Downloads/CALLING AGENTs/docs/s12-audit/screenshots';

async function screenshot(page, name) {
  const fname = `${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOTS, fname), fullPage: true });
  console.log(`  [screenshot] ${fname}`);
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
  console.log('[login] Admin logged in');

  // Get client IDs from clients page
  await page.goto(`${BASE}/dashboard/clients`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Extract client IDs from settings links
  const clientLinks = await page.$$eval('a[href*="settings?client_id"]', els =>
    els.map(e => {
      const match = e.href.match(/client_id=([^&]+)/);
      const clientName = e.closest('[class*="card"], div')?.textContent?.slice(0, 60);
      return { id: match ? match[1] : null, name: clientName || 'unknown' };
    }).filter((v, i, arr) => v.id && arr.findIndex(x => x.id === v.id) === i)
  );
  console.log(`[clients] Found ${clientLinks.length} clients:`);
  for (const cl of clientLinks) {
    console.log(`  ${cl.id} — ${cl.name.trim().slice(0, 50)}`);
  }

  // Pick two clients: Hasan Sharif and Windshield Hub
  const hasanId = clientLinks.find(c => c.name.includes('Hasan'))?.id;
  const windshieldId = clientLinks.find(c => c.name.includes('Windshield'))?.id;
  const urbanId = clientLinks.find(c => c.name.includes('Urban'))?.id;

  const clientsToTest = [
    { name: 'hasan', id: hasanId },
    { name: 'windshield', id: windshieldId },
  ].filter(c => c.id);

  for (const client of clientsToTest) {
    console.log(`\n=== Settings for ${client.name} (${client.id}) ===`);

    // Navigate to settings page
    await page.goto(`${BASE}/dashboard/settings?client_id=${client.id}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    await screenshot(page, `settings-${client.name}-main`);

    // Get page content
    const settingsText = await page.textContent('body');
    console.log(`[${client.name}] Settings text (first 2000): ${settingsText.slice(0, 2000)}`);

    // Look for tabs on settings page
    const settingsTabs = await page.$$eval('[role="tab"], [role="tablist"] button, button[data-state]', els =>
      els.map(e => ({
        text: e.textContent.trim(),
        selected: e.getAttribute('aria-selected') === 'true' || e.dataset?.state === 'active',
      }))
    );
    console.log(`[${client.name}] Tabs: ${JSON.stringify(settingsTabs)}`);

    // Try to find tab navigation by other means
    const allButtons = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 40));
    console.log(`[${client.name}] All buttons: ${JSON.stringify(allButtons)}`);

    // Check for agent setup page instead
    await page.goto(`${BASE}/dashboard/setup?client_id=${client.id}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    await screenshot(page, `setup-${client.name}-agent`);

    // Click through setup steps (1 Phone Setup, 2 Agent, 3 Context)
    const step2btn = await page.$('button:has-text("2Agent"), button:has-text("Agent")');
    if (step2btn) {
      await step2btn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, `setup-${client.name}-step2-agent`);

      const step2Text = await page.textContent('main');
      console.log(`[${client.name}] Step 2 (Agent): ${step2Text.slice(0, 1000)}`);
    }

    const step3btn = await page.$('button:has-text("3Context"), button:has-text("Context")');
    if (step3btn) {
      await step3btn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, `setup-${client.name}-step3-context`);

      const step3Text = await page.textContent('main');
      console.log(`[${client.name}] Step 3 (Context): ${step3Text.slice(0, 1000)}`);
    }

    // Go to Lab page for this client
    await page.goto(`${BASE}/dashboard/lab?client_id=${client.id}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    await screenshot(page, `lab-${client.name}`);
  }

  // Check Numbers page (admin only)
  console.log('\n=== Numbers page ===');
  await page.goto(`${BASE}/dashboard/numbers`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'admin-numbers');
  const numbersText = await page.textContent('body');
  console.log(`[numbers] Text: ${numbersText.slice(0, 500)}`);

  // Check Settings page (admin settings, not client settings)
  console.log('\n=== Admin Settings page ===');
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'admin-settings-no-client');
  const adminSettingsText = await page.textContent('body');
  console.log(`[admin-settings] Text: ${adminSettingsText.slice(0, 1000)}`);

  await browser.close();
  console.log('\n[DONE] Client settings screenshots complete');
})();
