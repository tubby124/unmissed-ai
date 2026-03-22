const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

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

  // Track API calls
  const apiCalls = [];
  page.on('response', async (resp) => {
    if (resp.url().includes('/api/') && !resp.url().includes('/_next/')) {
      let body = null;
      try { body = await resp.json(); } catch (e) {}
      apiCalls.push({ method: resp.request().method(), url: resp.url(), status: resp.status(), body });
    }
  });

  try {
    // Navigate through the full onboarding flow again
    console.log('=== STEP 1/6: Industry ===');
    await page.goto(`${BASE}/onboard`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Select Plumbing
    await page.click('button:has-text("Plumbing")');
    await page.waitForTimeout(500);

    // Fill website
    const websiteInput = await page.$('#websiteUrl, input[placeholder*="yourbusiness"]');
    if (websiteInput) await websiteInput.fill('https://example-plumbing.com');

    // Click Continue
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(2000);

    // STEP 2: Voice selection
    console.log('=== STEP 2/6: Voice ===');
    await screenshot(page, 'trial-step2-voice');
    const step2Text = await page.textContent('h1, h2, h3');
    console.log(`  [heading] ${step2Text?.trim()}`);

    // Check what's on this page
    const voiceButtons = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 60));
    console.log(`  [buttons] ${JSON.stringify(voiceButtons)}`);

    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(2000);

    // STEP 3: Business basics
    console.log('=== STEP 3/6: Business basics ===');
    await screenshot(page, 'trial-step3-business');

    // Fill required fields
    const fieldsToFill = {
      'businessName': 'S12 Audit Trial Test',
      'callbackPhone': '3065559999',
      'contactEmail': 's12-trial-test@example.com',
      'city': 'Saskatoon',
      'businessHoursText': '9am-5pm Mon-Fri',
      'servicesOffered': 'Plumbing services',
    };

    for (const [name, value] of Object.entries(fieldsToFill)) {
      const input = await page.$(`input[name="${name}"], #${name}, textarea[name="${name}"]`);
      if (input) {
        await input.fill(value);
        console.log(`  [fill] ${name}`);
      }
    }

    // Also try by placeholder
    const inputs = await page.$$('input:visible, textarea:visible');
    for (const input of inputs) {
      const val = await input.evaluate(el => el.value);
      if (!val) {
        const ph = await input.evaluate(el => el.placeholder);
        if (ph) {
          await input.fill('S12 test data');
          console.log(`  [fill] placeholder: ${ph}`);
        }
      }
    }

    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(2000);

    // STEP 4: Knowledge
    console.log('=== STEP 4/6: Knowledge ===');
    await screenshot(page, 'trial-step4-knowledge');

    // Skip knowledge - just click Continue (it's optional)
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(2000);

    // STEP 5: Call handling
    console.log('=== STEP 5/6: Call handling ===');
    await screenshot(page, 'trial-step5-handling');

    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(2000);

    // STEP 6: Review
    console.log('=== STEP 6/6: Review ===');
    await screenshot(page, 'trial-step6-review');

    // Scroll down to find the trial button
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await screenshot(page, 'trial-step6-review-bottom');

    // Find the REAL trial button (not the demo call button)
    const allButtons = await page.$$eval('button, a', els => els.map(e => ({
      tag: e.tagName,
      text: e.textContent.trim().slice(0, 80),
      href: e.href || '',
      class: e.className?.toString().slice(0, 100),
    })));
    console.log('  [all-buttons] On review page:');
    for (const btn of allButtons) {
      if (btn.text.length > 2 && btn.text.length < 80) {
        console.log(`    ${btn.tag}: "${btn.text}" ${btn.href ? `[${btn.href}]` : ''}`);
      }
    }

    // Click "Start 7-day free trial"
    const trialBtn = await page.$('button:has-text("Start 7-day free trial"), button:has-text("Start 7-day")');
    if (trialBtn) {
      console.log('\n  [FOUND] "Start 7-day free trial" button');
      await trialBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Watch for the POST response
      const [response] = await Promise.all([
        page.waitForResponse(resp =>
          resp.url().includes('/api/') && resp.request().method() === 'POST',
          { timeout: 30000 }
        ).catch(() => null),
        trialBtn.click(),
      ]);

      if (response) {
        console.log(`  [api] POST: ${response.url()} → ${response.status()}`);
        try {
          const respBody = await response.json();
          console.log(`  [api] Body: ${JSON.stringify(respBody).slice(0, 500)}`);
        } catch (e) {
          console.log(`  [api] Body: not JSON`);
        }
      }

      await page.waitForTimeout(8000);
      await screenshot(page, 'trial-after-click');
      console.log(`  [url] After trial click: ${page.url()}`);

      // Check what happened
      const afterText = await page.textContent('body');
      console.log(`  [after] Content: ${afterText.slice(0, 1500)}`);

      // Look for success indicators
      const hasSuccess = afterText.toLowerCase().includes('success') ||
                         afterText.toLowerCase().includes('created') ||
                         afterText.toLowerCase().includes('welcome') ||
                         afterText.toLowerCase().includes('activated');
      console.log(`  [success] Found success indicators: ${hasSuccess}`);

      // Check for dashboard link
      const dashLink = await page.$('a:has-text("Dashboard"), button:has-text("Dashboard"), a:has-text("Open your"), button:has-text("Open your")');
      if (dashLink) {
        const dashText = await dashLink.textContent();
        console.log(`  [dashboard] Found: "${dashText.trim()}"`);
        await screenshot(page, 'trial-success-screen');

        // Save any IDs
        const url = page.url();
        console.log(`  [url] Success page URL: ${url}`);
        fs.writeFileSync(path.join(SCREENSHOTS, 'trial-url.txt'), url);

        // Click to dashboard
        await dashLink.click();
        await page.waitForTimeout(5000);
        await screenshot(page, 'trial-dashboard-landing');
        console.log(`  [url] Dashboard: ${page.url()}`);

        // Document dashboard state
        const dashContent = await page.textContent('body');
        console.log(`  [dashboard] Content: ${dashContent.slice(0, 1000)}`);

        // Check if there's a login page instead
        if (page.url().includes('login')) {
          console.log('  [ISSUE] Redirected to login page! Trial user has no session.');
          await screenshot(page, 'trial-login-redirect');
        }
      } else {
        console.log('  [NO DASHBOARD] No dashboard button found on success page');
      }

    } else {
      console.log('  [ERROR] Trial button not found!');
      // Check if there's a different text
      const bottomButtons = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()));
      console.log(`  [buttons] All: ${JSON.stringify(bottomButtons)}`);
    }

    // Log all API calls
    console.log('\n=== API CALLS ===');
    for (const call of apiCalls) {
      console.log(`  ${call.method} ${call.url} → ${call.status}`);
      if (call.body) {
        console.log(`    Response: ${JSON.stringify(call.body).slice(0, 300)}`);
      }
    }

  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    console.error(err.stack);
    await screenshot(page, 'error-trial-click');
  }

  await context.close();
  await browser.close();
  console.log('\n[DONE] Trial click flow complete');
})();
