const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://unmissed-ai-production.up.railway.app';
const SCREENSHOT_DIR = path.join(__dirname, '../../docs/s12-audit/screenshots');

const findings = [];

function finding(track, severity, title, detail) {
  findings.push({ track, severity, title, detail });
  console.log(`  [${severity}] ${title}: ${detail}`);
}

async function run() {
  console.log('=== S12 Settings Tabs Deep Audit ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ page: page.url(), text: msg.text().substring(0, 200) });
    }
  });

  // Login
  console.log('--- Login ---');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', 'fix@windshieldhub.ca');
  await page.fill('input[type="password"]', 'qwerty123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  console.log('  Logged in successfully\n');

  // Navigate to settings
  await page.goto(`${BASE_URL}/dashboard/settings`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Actual tab names discovered
  const tabs = ['Agent', 'SMS', 'Voice', 'Alerts', 'Billing', 'Knowledge'];

  for (const tabName of tabs) {
    console.log(`\n--- Settings Tab: ${tabName} ---`);

    // Try clicking the tab
    let clicked = false;
    const selectors = [
      `button:has-text("${tabName}")`,
      `[role="tab"]:has-text("${tabName}")`,
      `a:has-text("${tabName}")`,
      `div:has-text("${tabName}"):not(:has(div:has-text("${tabName}")))`,
    ];

    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const isVisible = await el.isVisible();
          if (isVisible) {
            await el.click();
            await page.waitForTimeout(2000);
            clicked = true;
            break;
          }
        }
      } catch (e) { /* try next */ }
    }

    if (!clicked) {
      finding('A2', 'WARN', `Tab ${tabName}`, 'Could not click tab');
      continue;
    }

    // Full page screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `settings-tab-${tabName.toLowerCase()}-full.png`),
      fullPage: true
    });
    console.log(`  [screenshot] settings-tab-${tabName.toLowerCase()}-full.png`);

    // Tab-specific analysis
    if (tabName === 'Agent') {
      // Check for system prompt display
      const promptArea = await page.$('textarea, [class*="prompt"], pre, code');
      finding('A2', 'INFO', 'Agent tab - prompt area', promptArea ? 'Found prompt display area' : 'No prompt display');

      // Check for Refresh Agent button
      const refreshBtn = await page.$('button:has-text("Refresh"), button:has-text("Re-generate")');
      finding('A2', 'INFO', 'Agent tab - refresh button', refreshBtn ? 'Found Refresh Agent button' : 'No refresh button');

      // Check for Call Me button
      const callMeBtn = await page.$('button:has-text("Call Me"), button:has-text("Test Call")');
      finding('A2', 'INFO', 'Agent tab - Call Me', callMeBtn ? 'Found Call Me button' : 'No Call Me button');

      // Check for voice display
      const voiceDisplay = await page.$('text=/Blake|Ashley|Monika/');
      finding('A2', 'INFO', 'Agent tab - voice', voiceDisplay ? 'Voice name displayed' : 'No voice display');
    }

    if (tabName === 'SMS') {
      // Check for SMS toggle
      const toggles = await page.$$('input[type="checkbox"], [role="switch"], button[role="switch"]');
      finding('A5', 'INFO', 'SMS tab - toggles', `Found ${toggles.length} toggles`);

      // Check for SMS follow-up explanation
      const explanation = await page.$('text=/follow-up|text message|SMS/i');
      finding('A5', 'INFO', 'SMS tab - explanation text', explanation ? 'Has explanation' : 'No explanation text');

      // Check for phone number display
      const phoneField = await page.$('input[type="tel"]') || await page.$('text=/phone/i');
      finding('A5', 'INFO', 'SMS tab - phone field', phoneField ? 'Phone number visible' : 'No phone field');
    }

    if (tabName === 'Voice') {
      // Check for voice cards/options
      const voiceCards = await page.$$('[class*="voice"], [class*="card"]');
      finding('A2', 'INFO', 'Voice tab - voice options', `Found ${voiceCards.length} voice-related elements`);

      // Check for audio preview
      const audioPreview = await page.$('audio, button:has-text("Play"), button:has-text("Listen"), button:has-text("Preview")');
      finding('A2', 'INFO', 'Voice tab - audio preview', audioPreview ? 'Has audio preview' : 'No audio preview');
    }

    if (tabName === 'Alerts') {
      // This is the notifications/Telegram tab
      const telegramSection = await page.$('text=/Telegram|bot|chat ID/i');
      finding('A5', 'INFO', 'Alerts tab - Telegram section', telegramSection ? 'Telegram section found' : 'No Telegram section');

      // Does it guide you or just show a form?
      const setupGuide = await page.$('text=/step|how to|instructions|BotFather|set up/i');
      finding('A5', telegramSection && !setupGuide ? 'WARN' : 'INFO', 'Alerts tab - setup guidance',
        setupGuide ? 'Has setup instructions' : 'No setup guidance (just a form)');

      // Email notification toggle
      const emailToggle = await page.$('text=/email/i');
      finding('A5', 'INFO', 'Alerts tab - email notifications', emailToggle ? 'Email section found' : 'No email section');
    }

    if (tabName === 'Billing') {
      // Check what billing shows
      const usageStats = await page.$('text=/minutes|usage|plan|subscription/i');
      finding('A2', 'INFO', 'Billing tab - usage info', usageStats ? 'Usage/plan info visible' : 'No usage info');

      const upgradeBtn = await page.$('button:has-text("Upgrade"), button:has-text("Manage"), a:has-text("Manage")');
      finding('A2', 'INFO', 'Billing tab - manage/upgrade', upgradeBtn ? 'Manage/Upgrade button found' : 'No manage button');
    }

    if (tabName === 'Knowledge') {
      // Empty state check
      const emptyState = await page.$('text=/no knowledge|upload|add|get started|empty|no chunks|no documents/i');
      finding('A5', 'INFO', 'Knowledge tab - empty state', emptyState ? 'Has empty state message' : 'No empty state message');

      // Upload functionality
      const uploadBtn = await page.$('button:has-text("Upload"), input[type="file"], button:has-text("Add")');
      finding('A5', 'INFO', 'Knowledge tab - upload', uploadBtn ? 'Upload button found' : 'No upload button');

      // Existing chunks
      const chunks = await page.$$('[class*="chunk"], [class*="knowledge"], table tr');
      finding('A5', 'INFO', 'Knowledge tab - existing data', `Found ${chunks.length} knowledge-related elements`);
    }
  }

  // ===== DEEPER RLS CHECK =====
  console.log('\n\n--- Deep RLS & Network Check ---');

  // Check network requests for data leaks
  const networkRequests = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/') && response.status() === 200) {
      try {
        const body = await response.text();
        // Check if response contains other client slugs
        const otherSlugs = ['hasan-sharif', 'exp-realty', 'urban-vibe', 'manzil-isa'];
        for (const slug of otherSlugs) {
          if (body.includes(slug)) {
            finding('D1', 'CRITICAL', 'RLS data leak', `Response from ${url} contains slug "${slug}" (other client's data)`);
          }
        }
      } catch (e) { /* ignore */ }
    }
  });

  // Reload dashboard to trigger API calls
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Try API calls that should be restricted
  console.log('\n--- API Isolation Checks ---');
  const apiChecks = [
    { url: '/api/dashboard/system-pulse', name: 'system-pulse (unauthenticated endpoint)' },
  ];

  for (const check of apiChecks) {
    try {
      const resp = await page.goto(`${BASE_URL}${check.url}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const status = resp ? resp.status() : 'unknown';
      const body = await resp.text().catch(() => '');
      finding('D1', status === 200 ? 'WARN' : 'INFO', check.name, `Status: ${status}, body length: ${body.length}`);
      if (status === 200 && body.length > 10) {
        // Check if it exposes other client data
        const parsed = JSON.parse(body).catch ? null : JSON.parse(body);
        finding('D1', 'INFO', `${check.name} response`, body.substring(0, 200));
      }
    } catch (e) {
      finding('D1', 'INFO', check.name, `Error: ${e.message.substring(0, 80)}`);
    }
  }

  // ===== SAVE FINDINGS =====
  const findingsPath = path.join(SCREENSHOT_DIR, 'settings-findings.json');
  fs.writeFileSync(findingsPath, JSON.stringify({ findings, consoleErrors }, null, 2));
  console.log(`\nFindings saved to ${findingsPath}`);

  await context.close();
  await browser.close();
  console.log('\n=== Settings Tabs Audit Complete ===');
}

run().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
