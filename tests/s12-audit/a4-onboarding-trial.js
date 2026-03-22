const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

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

  // Collect all network responses for debugging
  const apiResponses = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('/api/') && !url.includes('/_next/')) {
      apiResponses.push({ url, status: resp.status(), method: resp.request().method() });
    }
  });

  try {
    // =====================================================
    // PATH 1: TRIAL FLOW — Walk through onboarding as a new user
    // =====================================================
    console.log('\n=== PATH 1: TRIAL FLOW ===\n');

    // Step 1: Navigate to /onboard
    console.log('[step 1] Navigating to /onboard');
    await page.goto(`${BASE}/onboard`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'onboard-01-landing');

    // Check current URL (might redirect)
    console.log(`  [url] Current URL: ${page.url()}`);

    // Detect what's on the page
    const pageContent = await page.textContent('body');
    console.log(`  [content] Page text (first 500 chars): ${pageContent.slice(0, 500)}`);

    // Check for form steps
    const formInputs = await page.$$eval('input, select, textarea', els => els.map(e => ({
      type: e.type || e.tagName.toLowerCase(),
      name: e.name,
      placeholder: e.placeholder,
      id: e.id,
      label: e.getAttribute('aria-label'),
    })));
    console.log(`  [form] Inputs found: ${JSON.stringify(formInputs)}`);

    // Check for step indicators
    const stepIndicators = await page.$$eval('[class*="step"], [class*="progress"], [role="progressbar"]', els => els.map(e => e.textContent.trim().slice(0, 100)));
    console.log(`  [steps] Step indicators: ${JSON.stringify(stepIndicators)}`);

    // Step 2: Fill out step 1 of intake form
    console.log('\n[step 2] Filling intake form - step 1');

    // Try to find and fill business name
    const businessNameInput = await page.$('input[name="businessName"], input[name="business_name"], input[placeholder*="business" i], input[placeholder*="company" i]');
    if (businessNameInput) {
      await businessNameInput.fill('S12 Test Audit Business');
      console.log('  [fill] Business name filled');
    } else {
      console.log('  [warn] Business name input not found');
      // Try all visible text inputs
      const textInputs = await page.$$('input[type="text"], input:not([type])');
      console.log(`  [debug] Found ${textInputs.length} text inputs`);
      for (let i = 0; i < textInputs.length; i++) {
        const attrs = await textInputs[i].evaluate(el => ({
          name: el.name, id: el.id, placeholder: el.placeholder,
          type: el.type, visible: el.offsetParent !== null,
          label: el.closest('label')?.textContent?.trim()
        }));
        console.log(`  [debug] Input ${i}: ${JSON.stringify(attrs)}`);
      }
    }

    // Try to find and fill other fields
    const emailInput = await page.$('input[type="email"], input[name="email"], input[name="contact_email"]');
    if (emailInput) {
      await emailInput.fill('s12-audit-test@unmissed.ai');
      console.log('  [fill] Email filled');
    }

    const phoneInput = await page.$('input[type="tel"], input[name="phone"], input[name="contact_phone"]');
    if (phoneInput) {
      await phoneInput.fill('+13065551234');
      console.log('  [fill] Phone filled');
    }

    // Look for niche/industry selector
    const nicheSelect = await page.$('select[name="niche"], select[name="industry"], [data-testid="niche-select"]');
    if (nicheSelect) {
      const nicheOptions = await nicheSelect.$$eval('option', opts => opts.map(o => ({ value: o.value, text: o.textContent.trim() })));
      console.log(`  [niche] Options: ${JSON.stringify(nicheOptions)}`);
      // Select plumbing or first non-empty option
      const plumbing = nicheOptions.find(o => o.value.toLowerCase().includes('plumb'));
      if (plumbing) {
        await nicheSelect.selectOption(plumbing.value);
      } else if (nicheOptions.length > 1) {
        await nicheSelect.selectOption(nicheOptions[1].value);
      }
      console.log('  [fill] Niche selected');
    }

    await page.waitForTimeout(1000);
    await screenshot(page, 'onboard-02-step1-filled');

    // Look for Next/Continue button
    const nextButton = await page.$('button:has-text("Next"), button:has-text("Continue"), button:has-text("next"), button[type="submit"]');
    if (nextButton) {
      const btnText = await nextButton.textContent();
      console.log(`  [button] Found: "${btnText.trim()}"`);
      await nextButton.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'onboard-03-step2');

      // Check what's on step 2
      const step2Content = await page.textContent('body');
      console.log(`  [step2] Content preview: ${step2Content.slice(0, 500)}`);
    } else {
      console.log('  [warn] No Next/Continue button found');
      const allButtons = await page.$$eval('button', btns => btns.map(b => ({ text: b.textContent.trim(), type: b.type, disabled: b.disabled })));
      console.log(`  [debug] All buttons: ${JSON.stringify(allButtons)}`);
    }

    // Try to navigate through remaining steps
    for (let step = 3; step <= 7; step++) {
      // Fill any visible inputs on this step
      const visibleInputs = await page.$$('input:visible, select:visible, textarea:visible');
      for (const input of visibleInputs) {
        const attrs = await input.evaluate(el => ({
          tag: el.tagName.toLowerCase(), type: el.type, name: el.name,
          placeholder: el.placeholder, value: el.value,
          label: el.closest('label')?.textContent?.trim() || el.getAttribute('aria-label'),
        }));

        if (!attrs.value && attrs.tag === 'input') {
          if (attrs.type === 'email') {
            await input.fill('s12-audit-test@unmissed.ai');
          } else if (attrs.type === 'tel') {
            await input.fill('+13065551234');
          } else if (attrs.type === 'url') {
            await input.fill('https://example-plumbing.com');
          } else if (attrs.type === 'text' || !attrs.type || attrs.type === '') {
            // Contextual fill based on name/placeholder/label
            const context = `${attrs.name} ${attrs.placeholder} ${attrs.label}`.toLowerCase();
            if (context.includes('name') && context.includes('business')) {
              await input.fill('S12 Test Audit Business');
            } else if (context.includes('name') && (context.includes('contact') || context.includes('your'))) {
              await input.fill('Test Owner');
            } else if (context.includes('address') || context.includes('location')) {
              await input.fill('123 Test St, Saskatoon SK');
            } else if (context.includes('website') || context.includes('url')) {
              await input.fill('https://example-plumbing.com');
            } else if (context.includes('hour') || context.includes('time')) {
              await input.fill('9am-5pm Mon-Fri');
            } else if (context.includes('service') || context.includes('offer')) {
              await input.fill('Plumbing repair, drain cleaning, emergency service');
            } else if (context.includes('area') || context.includes('region')) {
              await input.fill('Saskatoon and surrounding area');
            } else if (context.includes('agent') && context.includes('name')) {
              await input.fill('TestBot');
            } else {
              await input.fill('Test audit data');
            }
          }
        } else if (!attrs.value && attrs.tag === 'textarea') {
          await input.fill('This is test data for the S12 audit. Plumbing services in Saskatoon. Emergency repairs, drain cleaning, water heater installation.');
        } else if (attrs.tag === 'select') {
          const options = await input.$$eval('option', opts => opts.map(o => o.value).filter(v => v));
          if (options.length > 0 && !await input.evaluate(el => el.value)) {
            await input.selectOption(options[Math.min(1, options.length - 1)]);
          }
        }
      }

      // Screenshot current step
      await page.waitForTimeout(500);
      await screenshot(page, `onboard-0${step}-step${step}`);

      // Try clicking Next
      const nextBtn = await page.$('button:has-text("Next"), button:has-text("Continue"), button:has-text("next"), button[type="submit"]:not(:has-text("trial")):not(:has-text("Trial")):not(:has-text("pay")):not(:has-text("Pay"))');
      if (nextBtn) {
        const isDisabled = await nextBtn.evaluate(el => el.disabled);
        if (!isDisabled) {
          const btnText = await nextBtn.textContent();
          console.log(`  [step ${step}] Clicking: "${btnText.trim()}"`);
          await nextBtn.click();
          await page.waitForTimeout(2000);
        } else {
          console.log(`  [step ${step}] Next button is disabled - may need required fields`);
          break;
        }
      } else {
        // Check if we're on review/final step
        const trialBtn = await page.$('button:has-text("trial"), button:has-text("Trial"), button:has-text("free")');
        const payBtn = await page.$('button:has-text("pay"), button:has-text("Pay"), button:has-text("subscribe"), button:has-text("Subscribe")');
        if (trialBtn || payBtn) {
          console.log(`  [step ${step}] Found final action button(s)`);
          if (trialBtn) {
            const trialText = await trialBtn.textContent();
            console.log(`    Trial button: "${trialText.trim()}"`);
          }
          if (payBtn) {
            const payText = await payBtn.textContent();
            console.log(`    Pay button: "${payText.trim()}"`);
          }
          await screenshot(page, `onboard-review-screen`);
          break;
        }
        console.log(`  [step ${step}] No navigation button found, stopping`);
        break;
      }
    }

    // Step 6: Screenshot review screen and click trial
    console.log('\n[step 6] Review screen + trial activation');
    await screenshot(page, 'onboard-06-before-trial-click');

    // Get all visible text to understand what's shown
    const reviewText = await page.textContent('body');
    console.log(`  [review] Page content: ${reviewText.slice(0, 1000)}`);

    // Click trial button
    const trialButton = await page.$('button:has-text("trial"), button:has-text("Trial"), button:has-text("free"), button:has-text("Free")');
    if (trialButton) {
      const trialBtnText = await trialButton.textContent();
      console.log(`  [trial] Clicking: "${trialBtnText.trim()}"`);

      // Watch for API responses
      const apiResponsePromise = page.waitForResponse(resp =>
        resp.url().includes('/api/') && resp.request().method() === 'POST',
        { timeout: 15000 }
      ).catch(() => null);

      await trialButton.click();
      await page.waitForTimeout(5000);

      const apiResp = await apiResponsePromise;
      if (apiResp) {
        console.log(`  [api] POST response: ${apiResp.url()} → ${apiResp.status()}`);
        try {
          const respBody = await apiResp.json();
          console.log(`  [api] Response body: ${JSON.stringify(respBody).slice(0, 500)}`);
        } catch (e) {
          console.log(`  [api] Response body not JSON`);
        }
      }

      await screenshot(page, 'onboard-07-after-trial-click');
      console.log(`  [url] Current URL after trial: ${page.url()}`);

      // Wait for any redirect
      await page.waitForTimeout(3000);
      await screenshot(page, 'onboard-08-trial-result');
      console.log(`  [url] URL after wait: ${page.url()}`);

      // Check for success screen
      const successContent = await page.textContent('body');
      console.log(`  [result] Page content: ${successContent.slice(0, 1000)}`);

      // Look for "Open Dashboard" or similar button
      const dashboardBtn = await page.$('button:has-text("Dashboard"), a:has-text("Dashboard"), button:has-text("dashboard"), a:has-text("dashboard")');
      if (dashboardBtn) {
        const dashText = await dashboardBtn.textContent();
        console.log(`  [dashboard] Found button: "${dashText.trim()}"`);
        await screenshot(page, 'onboard-09-success-screen');

        // DON'T click it yet — first capture the intake ID from the URL
        const currentUrl = page.url();
        const intakeIdMatch = currentUrl.match(/[?&]id=([^&]+)/);
        if (intakeIdMatch) {
          console.log(`  [intake_id] Found in URL: ${intakeIdMatch[1]}`);
          fs.writeFileSync(path.join(SCREENSHOTS, 'intake-id.txt'), intakeIdMatch[1]);
        }

        // Now click to dashboard
        await dashboardBtn.click();
        await page.waitForTimeout(5000);
        await screenshot(page, 'onboard-10-trial-dashboard');
        console.log(`  [url] Dashboard URL: ${page.url()}`);
      }
    } else {
      console.log('  [warn] No trial button found');
    }

    // Log all API calls made during onboarding
    console.log(`\n[api-log] All API calls during onboarding:`);
    for (const r of apiResponses) {
      console.log(`  ${r.method} ${r.url} → ${r.status}`);
    }

  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    console.error(err.stack);
    await screenshot(page, 'error-onboarding');
  }

  await context.close();
  await browser.close();
  console.log('\n[DONE] Track A4 Path 1 (Trial Flow) complete');
})();
