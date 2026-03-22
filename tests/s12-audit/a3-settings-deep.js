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

  // 1. Navigate to /dashboard/setup (Agent page) - this is what "settings" is now
  console.log('\n=== Agent/Setup page ===');
  await page.goto(`${BASE}/dashboard/setup`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'setup-01-agent-page');

  // Analyze the page structure
  const setupPageText = await page.textContent('body');
  console.log(`[setup] Page text (first 1000): ${setupPageText.slice(0, 1000)}`);

  // Look for tabs on this page
  const allClickables = await page.$$eval('button, [role="tab"], a', els => els.map(e => ({
    tag: e.tagName,
    text: e.textContent.trim().slice(0, 60),
    role: e.getAttribute('role'),
    class: e.className?.toString().slice(0, 80),
    ariaSelected: e.getAttribute('aria-selected'),
  })).filter(e => e.text));
  console.log(`[setup] Clickable elements: ${JSON.stringify(allClickables.slice(0, 30), null, 2)}`);

  // Try clicking tab-like elements
  const tabLikeElements = allClickables.filter(e =>
    e.role === 'tab' ||
    e.class?.includes('tab') ||
    ['Agent', 'Business', 'Notification', 'Calendar', 'Knowledge', 'Billing', 'Voice', 'SMS', 'Info', 'Settings'].some(t => e.text.includes(t))
  );
  console.log(`[setup] Tab-like elements: ${JSON.stringify(tabLikeElements)}`);

  // 2. Navigate to /dashboard/clients to see client list
  console.log('\n=== Clients page ===');
  await page.goto(`${BASE}/dashboard/clients`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'setup-02-clients-list');

  const clientsContent = await page.textContent('body');
  console.log(`[clients] Page text (first 1500): ${clientsContent.slice(0, 1500)}`);

  // Find client links/cards
  const clientElements = await page.$$eval('a, button, [class*="client"], [class*="card"]', els => els.map(e => ({
    tag: e.tagName,
    href: e.href || '',
    text: e.textContent.trim().slice(0, 80),
    class: e.className?.toString().slice(0, 60),
  })).filter(e => e.text && (e.text.includes('Sharif') || e.text.includes('Windshield') || e.text.includes('Urban') || e.text.includes('Manzil') || e.text.includes('exp') || e.text.includes('plumbing') || e.href?.includes('client'))));
  console.log(`[clients] Client elements: ${JSON.stringify(clientElements, null, 2)}`);

  // 3. Try clicking on a specific client (Hasan Sharif)
  const hasanLink = await page.$('a:has-text("Hasan"), a:has-text("hasan"), a[href*="hasan"], button:has-text("Hasan"), button:has-text("hasan")');
  if (hasanLink) {
    console.log('\n=== Switching to Hasan Sharif ===');
    await hasanLink.click();
    await page.waitForTimeout(3000);
    await screenshot(page, 'setup-03-hasan-dashboard');
    console.log(`[hasan] URL: ${page.url()}`);

    // Navigate to setup/settings for this client
    await page.goto(`${BASE}/dashboard/setup`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'setup-04-hasan-agent');
  }

  // 4. Check all the new dashboard nav items
  const navPages = [
    { path: '/dashboard/setup', name: 'agent' },
    { path: '/dashboard/calls', name: 'calls-overview' },
    { path: '/dashboard/insights', name: 'insights' },
    { path: '/dashboard/live', name: 'live' },
    { path: '/dashboard/campaigns', name: 'campaigns' },
    { path: '/dashboard/intake', name: 'intake' },
    { path: '/dashboard/calendar', name: 'calendar' },
    { path: '/dashboard/demos', name: 'demos' },
    { path: '/dashboard/lab', name: 'lab' },
    { path: '/admin/costs', name: 'admin-costs' },
  ];

  for (const navPage of navPages) {
    try {
      const resp = await page.goto(`${BASE}${navPage.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      console.log(`\n[nav] ${navPage.path} → ${resp.status()}`);
      await screenshot(page, `nav-${navPage.name}`);
    } catch (e) {
      console.log(`[nav] ${navPage.path} → error: ${e.message}`);
    }
  }

  // 5. Check if there's a client context switcher anywhere
  console.log('\n=== Client Context Switcher Detection ===');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);

  // Check sidebar header area for client info
  const sidebarText = await page.$$eval('aside *, nav *', els => els
    .filter(e => e.children.length === 0 && e.textContent.trim())
    .map(e => e.textContent.trim())
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 30)
  );
  console.log(`[sidebar] Text elements: ${JSON.stringify(sidebarText)}`);

  // Check for any "All clients" or client name display
  const adminBadge = await page.$('text=Admin');
  if (adminBadge) {
    console.log('[admin] Admin badge found');
    // Try clicking it
    await adminBadge.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'setup-05-admin-badge-clicked');
  }

  // Check for any dropdown menu that might appear
  const dropdownMenus = await page.$$('[role="menu"], [role="listbox"], [class*="dropdown"], [class*="popover"]');
  console.log(`[dropdown] Found ${dropdownMenus.length} dropdown/popover elements after admin click`);

  await browser.close();
  console.log('\n[DONE] Track A3 Deep Settings complete');
})();
