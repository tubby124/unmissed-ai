const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://unmissed-ai-production.up.railway.app';
const SCREENSHOT_DIR = path.join(__dirname, '../../docs/s12-audit/screenshots');
const WIDTHS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

// Track console errors per page
const consoleLog = {};

function logConsole(pageName, msg) {
  if (!consoleLog[pageName]) consoleLog[pageName] = [];
  consoleLog[pageName].push({
    type: msg.type(),
    text: msg.text(),
  });
}

async function screenshot(page, name, fullPage = true) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage });
  console.log(`  [screenshot] ${name}.png`);
  return filePath;
}

async function waitAndScreenshot(page, name, waitSelector, timeout = 10000) {
  try {
    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout });
    }
  } catch (e) {
    console.log(`  [warn] Selector "${waitSelector}" not found for ${name}, screenshotting anyway`);
  }
  // Small delay to let rendering finish
  await page.waitForTimeout(1500);
  return screenshot(page, name);
}

async function run() {
  console.log('=== S12 Client Dashboard Audit ===\n');

  const browser = await chromium.launch({ headless: true });

  // ===== TRACK D2: AUTH FLOW =====
  console.log('--- Track D2: Auth Flow ---');

  // First, screenshot login page at all widths
  for (const vp of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    page.on('console', (msg) => logConsole(`login-${vp.name}`, msg));

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page, `d2-login-${vp.name}`);

    // Check for Google OAuth button
    const googleBtn = await page.$('button:has-text("Google"), a:has-text("Google"), button:has-text("Sign in with Google")');
    console.log(`  [${vp.name}] Google OAuth button: ${googleBtn ? 'FOUND' : 'NOT FOUND'}`);

    // Check for Forgot password link
    const forgotLink = await page.$('a:has-text("Forgot"), a:has-text("forgot"), a:has-text("Reset"), button:has-text("Forgot")');
    console.log(`  [${vp.name}] Forgot password link: ${forgotLink ? 'FOUND' : 'NOT FOUND'}`);

    await ctx.close();
  }

  // ===== LOGIN =====
  console.log('\n--- Login as Client (fix@windshieldhub.ca) ---');
  const mainCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await mainCtx.newPage();
  page.on('console', (msg) => logConsole('login-flow', msg));

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Fill login form
  await page.fill('input[type="email"]', 'fix@windshieldhub.ca');
  await page.fill('input[type="password"]', 'qwerty123');
  await screenshot(page, 'd2-login-filled');

  await page.click('button[type="submit"]');

  try {
    await page.waitForURL('**/dashboard**', { timeout: 20000 });
    console.log('  Login SUCCESS - redirected to dashboard');
    console.log(`  Current URL: ${page.url()}`);
  } catch (e) {
    console.log(`  Login FAILED or slow - current URL: ${page.url()}`);
    await screenshot(page, 'd2-login-failed');
  }

  await page.waitForTimeout(2000);
  await screenshot(page, 'd2-post-login-dashboard');

  // ===== TRACK A2: DASHBOARD PAGES AT ALL WIDTHS =====
  console.log('\n--- Track A2: Dashboard Pages ---');

  // Save cookies for reuse across contexts
  const cookies = await mainCtx.cookies();

  const dashboardPages = [
    { path: '/dashboard', name: 'calls', waitFor: 'main, [class*="dashboard"], [class*="calls"]' },
    { path: '/dashboard/leads', name: 'leads', waitFor: 'main, [class*="leads"]' },
    { path: '/dashboard/live', name: 'live', waitFor: 'main, [class*="live"]' },
    { path: '/dashboard/voices', name: 'voices', waitFor: 'main, [class*="voice"]' },
    { path: '/dashboard/setup', name: 'setup', waitFor: 'main, [class*="setup"]' },
    { path: '/dashboard/settings', name: 'settings', waitFor: 'main, [class*="settings"]' },
  ];

  for (const vp of WIDTHS) {
    console.log(`\n  [${vp.name} — ${vp.width}px]`);
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addCookies(cookies);
    const p = await ctx.newPage();
    p.on('console', (msg) => logConsole(`${vp.name}-general`, msg));

    for (const dp of dashboardPages) {
      console.log(`    Navigating to ${dp.path}...`);
      p.on('console', (msg) => logConsole(`${dp.name}-${vp.name}`, msg));

      try {
        await p.goto(`${BASE_URL}${dp.path}`, { waitUntil: 'networkidle', timeout: 30000 });
        await p.waitForTimeout(2000);
        await screenshot(p, `a2-${dp.name}-${vp.name}`);

        // Check for empty states
        const emptyIndicators = await p.$$('text=/no calls|no leads|no data|nothing here|get started|empty|no results/i');
        if (emptyIndicators.length > 0) {
          console.log(`    [empty-state] Found empty state indicator on ${dp.name}`);
        }

        // Check page title/heading
        const h1 = await p.$('h1, h2');
        if (h1) {
          const headingText = await h1.textContent();
          console.log(`    Heading: "${headingText.trim().substring(0, 60)}"`);
        }
      } catch (e) {
        console.log(`    ERROR navigating to ${dp.path}: ${e.message.substring(0, 100)}`);
        await screenshot(p, `a2-${dp.name}-${vp.name}-error`);
      }
    }

    await ctx.close();
  }

  // ===== SETTINGS TABS (desktop only, detailed) =====
  console.log('\n--- Track A2: Settings Tabs (detailed) ---');

  await page.goto(`${BASE_URL}/dashboard/settings`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Find all tab buttons/triggers
  const tabSelectors = [
    { label: 'Agent', patterns: ['text=Agent', 'button:has-text("Agent")', '[role="tab"]:has-text("Agent")'] },
    { label: 'Business', patterns: ['text=Business', 'button:has-text("Business")', '[role="tab"]:has-text("Business")'] },
    { label: 'Notifications', patterns: ['text=Notification', 'button:has-text("Notification")', '[role="tab"]:has-text("Notification")'] },
    { label: 'Calendar', patterns: ['text=Calendar', 'button:has-text("Calendar")', '[role="tab"]:has-text("Calendar")'] },
    { label: 'Knowledge', patterns: ['text=Knowledge', 'button:has-text("Knowledge")', '[role="tab"]:has-text("Knowledge")'] },
    { label: 'Billing', patterns: ['text=Billing', 'button:has-text("Billing")', '[role="tab"]:has-text("Billing")'] },
  ];

  // First screenshot the default tab
  await screenshot(page, 'a2-settings-default-desktop');

  // Get all visible tab-like elements for discovery
  const allButtons = await page.$$('button, [role="tab"], a[data-state], [data-radix-collection-item]');
  console.log(`  Found ${allButtons.length} interactive elements on settings page`);

  for (const btn of allButtons) {
    const text = await btn.textContent().catch(() => '');
    const role = await btn.getAttribute('role').catch(() => '');
    if (text.trim().length > 0 && text.trim().length < 30) {
      console.log(`    Button/Tab: "${text.trim()}" (role=${role || 'none'})`);
    }
  }

  // Click through each tab
  for (const tab of tabSelectors) {
    let clicked = false;
    for (const pattern of tab.patterns) {
      try {
        const el = await page.$(pattern);
        if (el) {
          await el.click();
          await page.waitForTimeout(2000);
          await screenshot(page, `a2-settings-${tab.label.toLowerCase()}-desktop`);
          console.log(`  [tab] ${tab.label} - captured`);
          clicked = true;
          break;
        }
      } catch (e) {
        // try next pattern
      }
    }
    if (!clicked) {
      console.log(`  [tab] ${tab.label} - NOT FOUND`);
    }
  }

  // ===== TRACK A5: EMPTY STATES & UX =====
  console.log('\n--- Track A5: Empty States & Edge Cases ---');

  // Check calls page for empty state
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const callItems = await page.$$('table tr, [class*="call"], [class*="row"]');
  console.log(`  Calls page: ${callItems.length} rows/items found`);
  if (callItems.length <= 1) {
    console.log('  [empty-state] Calls page appears empty or has only header');
  }

  // Check leads page empty state
  await page.goto(`${BASE_URL}/dashboard/leads`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const leadItems = await page.$$('table tr, [class*="lead"], [class*="row"]');
  console.log(`  Leads page: ${leadItems.length} rows/items found`);

  // ===== TRACK D1: RLS ISOLATION =====
  console.log('\n--- Track D1: RLS Isolation ---');

  // Check URL for client IDs
  const currentUrl = page.url();
  console.log(`  Current URL: ${currentUrl}`);
  console.log(`  URL contains client ID: ${/[0-9a-f]{8}-[0-9a-f]{4}/.test(currentUrl) ? 'YES (potential issue)' : 'NO'}`);

  // Check for multi-client selector
  const clientSelector = await page.$('[class*="client-select"], select:has(option), [class*="client-switch"], [class*="selector"]');
  console.log(`  Client selector visible: ${clientSelector ? 'YES (ISSUE)' : 'NO (correct)'}`);

  // Check sidebar/nav for admin indicators
  const adminLinks = await page.$$('text=/admin|all clients|manage|users/i');
  console.log(`  Admin-only UI elements: ${adminLinks.length > 0 ? `FOUND (${adminLinks.length})` : 'NONE (correct)'}`);

  // ===== TRACK D3: ADMIN SCOPE CHECK =====
  console.log('\n--- Track D3: Admin Scope Check ---');

  // Try to access admin routes
  const adminRoutes = [
    '/admin',
    '/dashboard/admin',
    '/api/admin/save-prompt',
    '/api/admin/sync-agents',
    '/api/admin/test-activate',
  ];

  for (const route of adminRoutes) {
    try {
      const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const status = response ? response.status() : 'unknown';
      const finalUrl = page.url();
      console.log(`  ${route}: status=${status}, redirected=${finalUrl !== BASE_URL + route ? 'YES -> ' + finalUrl.replace(BASE_URL, '') : 'NO'}`);

      if (route === '/admin' || route === '/dashboard/admin') {
        await page.waitForTimeout(1500);
        await screenshot(page, `d3-admin-access-${route.replace(/\//g, '-').substring(1)}`);
      }
    } catch (e) {
      console.log(`  ${route}: ${e.message.substring(0, 80)}`);
    }
  }

  // Check if AdminTestPanel component is visible
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const testPanel = await page.$('[class*="AdminTestPanel"], [class*="test-panel"], [data-testid="admin-test-panel"]');
  console.log(`  AdminTestPanel visible: ${testPanel ? 'YES (ISSUE)' : 'NO (correct)'}`);

  // Check for admin command strip
  const cmdStrip = await page.$('[class*="AdminCommandStrip"], [class*="command-strip"]');
  console.log(`  AdminCommandStrip visible: ${cmdStrip ? 'YES (ISSUE)' : 'NO (correct)'}`);

  // ===== CAPTURE CONSOLE ERRORS =====
  console.log('\n--- Console Errors Summary ---');
  const errorSummary = {};
  for (const [pageName, msgs] of Object.entries(consoleLog)) {
    const errors = msgs.filter(m => m.type === 'error' || m.type === 'warning');
    if (errors.length > 0) {
      errorSummary[pageName] = errors;
      console.log(`  ${pageName}: ${errors.length} errors/warnings`);
      for (const e of errors.slice(0, 3)) {
        console.log(`    [${e.type}] ${e.text.substring(0, 120)}`);
      }
    }
  }

  await mainCtx.close();
  await browser.close();

  // Write console log to file
  const logPath = path.join(SCREENSHOT_DIR, 'console-errors.json');
  fs.writeFileSync(logPath, JSON.stringify(consoleLog, null, 2));
  console.log(`\nConsole log saved to ${logPath}`);

  console.log('\n=== Audit Complete ===');
}

run().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
