const { chromium } = require('playwright');
const path = require('path');

const BASE = 'https://unmissed-ai-production.up.railway.app';
const SCREENSHOTS = '/Users/owner/Downloads/CALLING AGENTs/docs/s12-audit/screenshots';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

async function screenshot(page, name, vp) {
  const fname = `${name}-${vp.name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOTS, fname), fullPage: true });
  console.log(`  [screenshot] ${fname}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', 'admin@unmissed.ai');
  await page.fill('input[type="password"]', 'COOLboy1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  console.log('[login] Admin logged in successfully');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    try {
      // 1. Login + dashboard home
      await login(page);
      await page.waitForTimeout(2000);
      await screenshot(page, '01-dashboard-home', vp);

      // 2. Check for client selector
      const clientSelector = await page.$('[data-testid="client-selector"], select, [role="combobox"]');
      console.log(`  [check] Client selector found: ${!!clientSelector}`);

      // Look for client selector by inspecting dropdowns or selects
      const selects = await page.$$('select');
      const comboboxes = await page.$$('[role="combobox"]');
      console.log(`  [check] Select elements: ${selects.length}, Comboboxes: ${comboboxes.length}`);

      // Try to find client list/cards
      const allLinks = await page.$$eval('a[href*="/dashboard"]', els => els.map(e => ({ href: e.href, text: e.textContent.trim() })));
      console.log(`  [check] Dashboard links found: ${JSON.stringify(allLinks.slice(0, 10))}`);

      // 3. Check for admin-specific elements (command strip, sync button)
      const adminElements = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()).filter(t => t.length > 0));
      console.log(`  [check] Buttons on dashboard: ${JSON.stringify(adminElements.slice(0, 20))}`);

      // 4. Navigate to settings
      await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
      await screenshot(page, '02-settings-main', vp);

      // 5. Check settings tabs
      const tabs = await page.$$eval('[role="tab"], button[data-state], .tab, [class*="tab"]', els => els.map(e => e.textContent.trim()));
      console.log(`  [check] Settings tabs found: ${JSON.stringify(tabs.slice(0, 15))}`);

      // Click through each tab and screenshot
      const tabButtons = await page.$$('[role="tab"], [role="tablist"] button');
      for (let i = 0; i < tabButtons.length && i < 8; i++) {
        try {
          const tabText = await tabButtons[i].textContent();
          await tabButtons[i].click();
          await page.waitForTimeout(1500);
          const safeName = tabText.trim().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 30);
          await screenshot(page, `03-settings-tab-${safeName}`, vp);
        } catch (e) {
          console.log(`  [warn] Tab ${i} click failed: ${e.message}`);
        }
      }

      // 6. Try switching clients if there's a way
      // Look for client switcher in sidebar or header
      const sidebarLinks = await page.$$eval('nav a, aside a, [class*="sidebar"] a', els => els.map(e => ({ href: e.href, text: e.textContent.trim() })));
      console.log(`  [check] Sidebar/nav links: ${JSON.stringify(sidebarLinks.slice(0, 15))}`);

      // 7. Check for client list/admin panel
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);

      // Try to find and click a client selector
      // Common patterns: dropdown, select, sidebar client list
      const clientDropdown = await page.$('select:has(option)');
      if (clientDropdown) {
        const options = await clientDropdown.$$eval('option', opts => opts.map(o => ({ value: o.value, text: o.textContent.trim() })));
        console.log(`  [check] Client dropdown options: ${JSON.stringify(options)}`);

        // Switch to second client if available
        if (options.length > 1) {
          await clientDropdown.selectOption(options[1].value);
          await page.waitForTimeout(2000);
          await screenshot(page, '04-dashboard-client-switched', vp);

          // Go to settings for this client
          await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle', timeout: 20000 });
          await page.waitForTimeout(2000);
          await screenshot(page, '05-settings-second-client', vp);
        }
      }

      // 8. Check for admin-only pages
      const adminPages = ['/dashboard/admin', '/admin', '/dashboard/clients'];
      for (const adminPage of adminPages) {
        try {
          const resp = await page.goto(`${BASE}${adminPage}`, { waitUntil: 'networkidle', timeout: 10000 });
          if (resp && resp.status() < 400) {
            await page.waitForTimeout(1500);
            await screenshot(page, `06-admin-page-${adminPage.replace(/\//g, '-').slice(1)}`, vp);
            console.log(`  [check] Admin page ${adminPage}: ${resp.status()}`);
          } else {
            console.log(`  [check] Admin page ${adminPage}: ${resp ? resp.status() : 'no response'}`);
          }
        } catch (e) {
          console.log(`  [check] Admin page ${adminPage}: failed - ${e.message}`);
        }
      }

      // 9. Check voices page
      await page.goto(`${BASE}/dashboard/voices`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      await screenshot(page, '07-voices-page', vp);

      // 10. Check leads page
      await page.goto(`${BASE}/dashboard/leads`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      await screenshot(page, '08-leads-page', vp);

      // 11. Check calls page
      await page.goto(`${BASE}/dashboard/calls`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      await screenshot(page, '09-calls-page', vp);

      // 12. Snapshot the full page HTML structure for analysis
      if (vp.name === 'desktop') {
        await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1500);
        const bodyHTML = await page.evaluate(() => {
          // Get a structural summary
          const getAllElements = (el, depth = 0) => {
            if (depth > 4) return '';
            let result = '';
            for (const child of el.children) {
              const tag = child.tagName.toLowerCase();
              const cls = child.className ? `.${child.className.toString().split(' ').slice(0, 2).join('.')}` : '';
              const id = child.id ? `#${child.id}` : '';
              const text = child.textContent?.trim().slice(0, 50) || '';
              const role = child.getAttribute('role') ? `[role=${child.getAttribute('role')}]` : '';
              result += '  '.repeat(depth) + `<${tag}${id}${cls}${role}> ${text}\n`;
              result += getAllElements(child, depth + 1);
            }
            return result;
          };
          return getAllElements(document.body);
        });
        console.log(`\n[DOM STRUCTURE - dashboard]\n${bodyHTML.slice(0, 5000)}`);
      }

    } catch (err) {
      console.error(`[ERROR] ${vp.name}: ${err.message}`);
      await page.screenshot({ path: path.join(SCREENSHOTS, `error-${vp.name}.png`), fullPage: true });
    }

    await context.close();
  }

  await browser.close();
  console.log('\n[DONE] Track A3 complete');
})();
