const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://unmissed-ai-production.up.railway.app';
const SCREENSHOT_DIR = path.join(__dirname, '../../docs/s12-audit/screenshots');

async function run() {
  console.log('=== S12 Security Deep Check ===\n');

  const browser = await chromium.launch({ headless: true });

  // ===== TEST 1: system-pulse WITHOUT any auth (fresh browser) =====
  console.log('--- Test 1: system-pulse unauthenticated (fresh browser, no cookies) ---');
  const anonCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const anonPage = await anonCtx.newPage();

  try {
    const resp = await anonPage.goto(`${BASE_URL}/api/dashboard/system-pulse`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    const status = resp.status();
    const body = await resp.text();
    console.log(`  Status: ${status}`);
    console.log(`  Body: ${body}`);

    if (status === 200) {
      console.log('  [CRITICAL] system-pulse is fully unauthenticated - exposes all client slugs and agent health');
      try {
        const parsed = JSON.parse(body);
        if (parsed.agents) {
          console.log(`  Exposed client slugs: ${Object.keys(parsed.agents).join(', ')}`);
        }
      } catch (e) { /* not json */ }
    }
  } catch (e) {
    console.log(`  Error: ${e.message.substring(0, 100)}`);
  }
  await anonCtx.close();

  // ===== TEST 2: Try accessing dashboard pages without login =====
  console.log('\n--- Test 2: Dashboard pages without authentication ---');
  const anonCtx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const anonPage2 = await anonCtx2.newPage();

  const protectedPages = [
    '/dashboard',
    '/dashboard/settings',
    '/dashboard/leads',
    '/dashboard/voices',
  ];

  for (const pg of protectedPages) {
    try {
      const resp = await anonPage2.goto(`${BASE_URL}${pg}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      const status = resp.status();
      const finalUrl = anonPage2.url();
      const redirected = !finalUrl.includes(pg) || finalUrl.includes('/login');
      console.log(`  ${pg}: status=${status}, final=${finalUrl.replace(BASE_URL, '')}, auth_redirect=${redirected ? 'YES (good)' : 'NO (ISSUE)'}`);
    } catch (e) {
      console.log(`  ${pg}: Error - ${e.message.substring(0, 80)}`);
    }
  }
  await anonCtx2.close();

  // ===== TEST 3: Login and check sidebar nav items more carefully =====
  console.log('\n--- Test 3: Sidebar nav audit (logged in as client) ---');
  const authCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const authPage = await authCtx.newPage();

  await authPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await authPage.fill('input[type="email"]', 'fix@windshieldhub.ca');
  await authPage.fill('input[type="password"]', 'qwerty123');
  await authPage.click('button[type="submit"]');
  await authPage.waitForURL('**/dashboard**', { timeout: 20000 });
  await authPage.waitForTimeout(2000);

  // Get all nav links
  const navLinks = await authPage.$$('nav a, aside a, [class*="sidebar"] a, [class*="nav"] a');
  console.log(`  Found ${navLinks.length} nav links`);
  for (const link of navLinks) {
    const text = await link.textContent().catch(() => '');
    const href = await link.getAttribute('href').catch(() => '');
    if (text.trim().length > 0) {
      console.log(`    "${text.trim()}" -> ${href || 'no href'}`);
    }
  }

  // Check for "Insights" page (seen in sidebar)
  console.log('\n--- Test 4: Insights page ---');
  try {
    await authPage.goto(`${BASE_URL}/dashboard/insights`, { waitUntil: 'networkidle', timeout: 15000 });
    await authPage.waitForTimeout(2000);
    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'a2-insights-desktop.png'),
      fullPage: true
    });
    console.log('  [screenshot] a2-insights-desktop.png');
    const h1 = await authPage.$('h1, h2');
    if (h1) {
      const headingText = await h1.textContent();
      console.log(`  Heading: "${headingText.trim()}"`);
    }
  } catch (e) {
    console.log(`  Error: ${e.message.substring(0, 80)}`);
  }

  // Check for "Advisor" page (seen in sidebar)
  console.log('\n--- Test 5: Advisor page ---');
  try {
    await authPage.goto(`${BASE_URL}/dashboard/advisor`, { waitUntil: 'networkidle', timeout: 15000 });
    await authPage.waitForTimeout(2000);
    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'a2-advisor-desktop.png'),
      fullPage: true
    });
    console.log('  [screenshot] a2-advisor-desktop.png');
    const h1 = await authPage.$('h1, h2');
    if (h1) {
      const headingText = await h1.textContent();
      console.log(`  Heading: "${headingText.trim()}"`);
    }
  } catch (e) {
    console.log(`  Error: ${e.message.substring(0, 80)}`);
  }

  // ===== TEST 6: Check if client can see other client data via API =====
  console.log('\n--- Test 6: API data isolation ---');

  // Try fetching call logs - should only show windshield-hub data
  try {
    const resp = await authPage.goto(`${BASE_URL}/api/dashboard/calls`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    const status = resp.status();
    const body = await resp.text();
    console.log(`  /api/dashboard/calls: status=${status}, body_len=${body.length}`);

    if (status === 200 && body.length > 10) {
      const otherSlugs = ['hasan-sharif', 'exp-realty', 'urban-vibe', 'manzil-isa'];
      for (const slug of otherSlugs) {
        if (body.includes(slug)) {
          console.log(`  [CRITICAL] Call data contains other client slug: ${slug}`);
        }
      }
      if (!otherSlugs.some(s => body.includes(s))) {
        console.log('  [PASS] No other client slugs in call data');
      }
    }
  } catch (e) {
    console.log(`  Error: ${e.message.substring(0, 80)}`);
  }

  // ===== TEST 7: Check Live Activity sidebar for data isolation =====
  console.log('\n--- Test 7: Live Activity sidebar data isolation ---');
  await authPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  await authPage.waitForTimeout(2000);

  // The live activity sidebar shows phone numbers - check if any data is from other clients
  const liveActivityItems = await authPage.$$('[class*="activity"] li, [class*="LIVE"] + * li, [class*="live"] li');
  console.log(`  Live activity items visible: ${liveActivityItems.length}`);

  // ===== TEST 8: Check the "Agent" page (different from settings) =====
  console.log('\n--- Test 8: Agent page (separate from settings) ---');
  try {
    // The sidebar shows "Agent" as a separate page
    const agentLink = await authPage.$('a[href*="/dashboard/agent"], a[href*="/agent"]');
    if (agentLink) {
      await agentLink.click();
      await authPage.waitForTimeout(2000);
      console.log(`  Navigated to: ${authPage.url()}`);
      await authPage.screenshot({
        path: path.join(SCREENSHOT_DIR, 'a2-agent-page-desktop.png'),
        fullPage: true
      });
      console.log('  [screenshot] a2-agent-page-desktop.png');
    } else {
      console.log('  No separate Agent link found in sidebar');
    }
  } catch (e) {
    console.log(`  Error: ${e.message.substring(0, 80)}`);
  }

  await authCtx.close();
  await browser.close();
  console.log('\n=== Security Deep Check Complete ===');
}

run().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
