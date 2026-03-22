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
    // ==========================================
    // STEP 1: YOUR INDUSTRY (page 1/6)
    // ==========================================
    console.log('\n=== STEP 1/6: YOUR INDUSTRY ===');
    await page.goto(`${BASE}/onboard`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'onboard-step1-industry');

    // Select "Plumbing" industry
    const plumbingBtn = await page.$('button:has-text("Plumbing")');
    if (plumbingBtn) {
      await plumbingBtn.click();
      await page.waitForTimeout(500);
      console.log('  [action] Selected Plumbing industry');
    }

    // Fill business search
    const searchInput = await page.$('input[placeholder*="Search your business"]');
    if (searchInput) {
      await searchInput.fill('S12 Test Audit Plumbing');
      console.log('  [action] Filled business search');
    }

    // Fill website
    const websiteInput = await page.$('#websiteUrl, input[placeholder*="yourbusiness"]');
    if (websiteInput) {
      await websiteInput.fill('https://example-plumbing.com');
      console.log('  [action] Filled website URL');
    }

    await page.waitForTimeout(500);
    await screenshot(page, 'onboard-step1-filled');

    // Click Continue
    const continueBtn1 = await page.$('button:has-text("Continue")');
    if (continueBtn1) {
      const isDisabled = await continueBtn1.evaluate(el => el.disabled);
      console.log(`  [button] Continue disabled: ${isDisabled}`);
      if (!isDisabled) {
        await continueBtn1.click();
        await page.waitForTimeout(3000);
        console.log(`  [nav] URL after step 1: ${page.url()}`);
      } else {
        console.log('  [ERROR] Continue still disabled after filling form');
        // Debug: check what's required
        const bodyText = await page.textContent('body');
        console.log(`  [debug] Current page state: ${bodyText.slice(0, 500)}`);
      }
    }

    // ==========================================
    // STEP 2: BUSINESS DETAILS (page 2/6)
    // ==========================================
    console.log('\n=== STEP 2/6 ===');
    await page.waitForTimeout(1000);
    await screenshot(page, 'onboard-step2-business');

    const step2Heading = await page.textContent('h1, h2, h3');
    console.log(`  [heading] ${step2Heading?.trim()}`);

    // Fill all visible inputs
    const fillInputByContext = async (page) => {
      const inputs = await page.$$('input:visible, textarea:visible');
      for (const input of inputs) {
        const attrs = await input.evaluate(el => ({
          type: el.type, name: el.name, id: el.id,
          placeholder: el.placeholder, value: el.value,
          label: el.closest('label')?.textContent?.trim() ||
                 document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim(),
          required: el.required,
        }));

        if (attrs.value) continue; // already filled

        const ctx = `${attrs.name} ${attrs.id} ${attrs.placeholder} ${attrs.label}`.toLowerCase();

        if (attrs.type === 'email') await input.fill('s12audit@example.com');
        else if (attrs.type === 'tel') await input.fill('3065551234');
        else if (attrs.type === 'url') await input.fill('https://example-plumbing.com');
        else if (ctx.includes('business') && ctx.includes('name')) await input.fill('S12 Test Audit Plumbing');
        else if (ctx.includes('contact') && ctx.includes('name') || ctx.includes('your name') || ctx.includes('full name')) await input.fill('Test McAudit');
        else if (ctx.includes('phone') || ctx.includes('number')) await input.fill('3065551234');
        else if (ctx.includes('email')) await input.fill('s12audit@example.com');
        else if (ctx.includes('address') || ctx.includes('location')) await input.fill('123 Test St, Saskatoon SK S7H 0J1');
        else if (ctx.includes('city')) await input.fill('Saskatoon');
        else if (ctx.includes('area') || ctx.includes('service area') || ctx.includes('region')) await input.fill('Saskatoon and surrounding area');
        else if (ctx.includes('agent') && ctx.includes('name')) await input.fill('TestBot');
        else if (ctx.includes('hour') || ctx.includes('time')) await input.fill('9am-5pm Mon-Fri');
        else if (ctx.includes('service') || ctx.includes('offer')) await input.fill('Plumbing repair, drain cleaning, water heater installation');
        else if (ctx.includes('website') || ctx.includes('url')) await input.fill('https://example-plumbing.com');
        else if (attrs.type === 'text' || !attrs.type) await input.fill('S12 test data');

        console.log(`  [fill] ${attrs.name || attrs.id || attrs.placeholder || 'unknown'} = filled`);
      }

      // Handle selects
      const selects = await page.$$('select:visible');
      for (const sel of selects) {
        const opts = await sel.$$eval('option', opts => opts.map(o => ({ value: o.value, text: o.textContent.trim() })).filter(o => o.value));
        if (opts.length > 0) {
          const val = await sel.evaluate(el => el.value);
          if (!val) {
            await sel.selectOption(opts[Math.min(1, opts.length - 1)].value);
            console.log(`  [select] Selected: ${opts[Math.min(1, opts.length - 1)].text}`);
          }
        }
      }

      // Handle textareas
      const textareas = await page.$$('textarea:visible');
      for (const ta of textareas) {
        const val = await ta.evaluate(el => el.value);
        if (!val) {
          await ta.fill('We provide emergency plumbing services 24/7 in Saskatoon. Drain cleaning, pipe repair, water heater installation. Licensed and insured. Call us anytime.');
          console.log(`  [fill] textarea filled`);
        }
      }
    };

    await fillInputByContext(page);
    await page.waitForTimeout(500);
    await screenshot(page, 'onboard-step2-filled');

    // Navigate through remaining steps (3-6)
    for (let step = 3; step <= 7; step++) {
      // Try to click Continue
      const contBtn = await page.$('button:has-text("Continue")');
      if (contBtn) {
        const disabled = await contBtn.evaluate(el => el.disabled);
        if (disabled) {
          console.log(`  [step ${step}] Continue disabled — may need more input`);
          // Try filling any new inputs
          await fillInputByContext(page);
          await page.waitForTimeout(500);

          // Recheck
          const stillDisabled = await contBtn.evaluate(el => el.disabled);
          if (stillDisabled) {
            console.log(`  [step ${step}] Still disabled after fill attempt`);
            // Check for checkboxes or radio buttons
            const checkboxes = await page.$$('input[type="checkbox"]:visible:not(:checked)');
            for (const cb of checkboxes) {
              await cb.check();
              console.log(`  [check] Checked a checkbox`);
            }
            await page.waitForTimeout(500);
          }
        }

        const finalDisabled = await contBtn.evaluate(el => el.disabled);
        if (!finalDisabled) {
          console.log(`\n=== STEP ${step}/6 ===`);
          await contBtn.click();
          await page.waitForTimeout(3000);
        } else {
          console.log(`  [BLOCKED] Cannot proceed past step ${step - 1}`);
          await screenshot(page, `onboard-step${step}-blocked`);
          break;
        }
      } else {
        // No continue button — check for trial/payment buttons
        console.log(`\n=== FINAL STEP (step ${step - 1}) ===`);
      }

      // Screenshot current state
      await screenshot(page, `onboard-step${step}`);

      const heading = await page.$eval('h1, h2, h3', el => el.textContent.trim()).catch(() => 'none');
      console.log(`  [heading] ${heading}`);

      // Get all visible text
      const mainText = await page.$eval('main, [role="main"], .main-content', el => el.textContent.trim().slice(0, 800)).catch(() => '');
      if (mainText) console.log(`  [content] ${mainText.slice(0, 500)}`);

      // Fill inputs on this step
      await fillInputByContext(page);

      // Check for trial button
      const trialBtn = await page.$('button:has-text("trial"), button:has-text("Trial"), button:has-text("free"), button:has-text("Free")');
      if (trialBtn) {
        console.log('\n=== TRIAL BUTTON FOUND ===');
        const trialText = await trialBtn.textContent();
        console.log(`  [trial] Button text: "${trialText.trim()}"`);
        await screenshot(page, 'onboard-review-before-trial');

        // Document what's on the review page
        const allVisibleText = await page.textContent('body');
        console.log(`  [review-page] Full text: ${allVisibleText.slice(0, 2000)}`);

        // Look for a payment/paid option too
        const payBtn = await page.$('button:has-text("Subscribe"), button:has-text("Pay"), button:has-text("purchase"), a:has-text("Subscribe")');
        if (payBtn) {
          const payText = await payBtn.textContent();
          console.log(`  [pay] Pay button also found: "${payText.trim()}"`);
        }

        // Click trial
        console.log('  [action] Clicking trial button...');
        await trialBtn.click();
        await page.waitForTimeout(8000);
        await screenshot(page, 'onboard-after-trial');
        console.log(`  [url] After trial: ${page.url()}`);

        // Check for success screen
        const afterTrialText = await page.textContent('body');
        console.log(`  [after-trial] Content: ${afterTrialText.slice(0, 1000)}`);

        // Look for dashboard button
        const dashBtn = await page.$('a:has-text("Dashboard"), button:has-text("Dashboard"), a:has-text("dashboard"), button:has-text("dashboard")');
        if (dashBtn) {
          console.log('  [action] Found Dashboard button');
          await screenshot(page, 'onboard-success-screen');

          // Extract intake ID from URL or page
          const url = page.url();
          const idMatch = url.match(/[?&]id=([a-f0-9-]+)/i);
          if (idMatch) {
            console.log(`  [intake_id] ${idMatch[1]}`);
            fs.writeFileSync(path.join(SCREENSHOTS, 'intake-id.txt'), idMatch[1]);
          }

          // Also check for client_id in the page
          const pageSource = await page.content();
          const clientIdMatch = pageSource.match(/client_id[=:]["']([a-f0-9-]+)/i);
          if (clientIdMatch) {
            console.log(`  [client_id] ${clientIdMatch[1]}`);
            fs.writeFileSync(path.join(SCREENSHOTS, 'trial-client-id.txt'), clientIdMatch[1]);
          }

          // Click dashboard button
          await dashBtn.click();
          await page.waitForTimeout(5000);
          await screenshot(page, 'onboard-trial-dashboard');
          console.log(`  [url] Dashboard: ${page.url()}`);

          // Check dashboard state
          const dashText = await page.textContent('body');
          console.log(`  [dashboard] Content: ${dashText.slice(0, 1000)}`);
        }

        break; // Done with flow
      }

      // Check for "Get Started" or "Launch" type buttons
      const launchBtn = await page.$('button:has-text("Get Started"), button:has-text("Launch"), button:has-text("Create"), button:has-text("Finish")');
      if (launchBtn) {
        const launchText = await launchBtn.textContent();
        console.log(`  [launch] Found: "${launchText.trim()}"`);
      }
    }

    // Log all API calls
    console.log('\n=== API CALLS DURING ONBOARDING ===');
    for (const call of apiCalls) {
      console.log(`  ${call.method} ${call.url} → ${call.status}`);
      if (call.body && call.method === 'POST') {
        console.log(`    Body: ${JSON.stringify(call.body).slice(0, 200)}`);
      }
    }

  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    console.error(err.stack);
    await screenshot(page, 'error-onboarding-v2');
  }

  await context.close();
  await browser.close();
  console.log('\n[DONE] Onboarding trial flow complete');
})();
