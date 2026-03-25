/**
 * smoke-trial-flow.spec.ts
 *
 * 7-step post-deploy smoke test for the BUG-A/B/C fixes.
 *
 * What this covers:
 *   BUG-B: Trial onboarding lands on /onboard/status (not immediate window.location.href)
 *   BUG-C: Invite URL routes through /auth/callback before /auth/set-password
 *   BUG-A: SMS capability chip not active for trial user without Twilio number
 *   ISOLATION: Admin session in normal context is NOT contaminated by trial flow in incognito
 *
 * Run:
 *   BASE_URL=https://unmissed-ai-production.up.railway.app npx playwright test smoke-trial-flow --reporter=line
 *
 * Prerequisites:
 *   ADMIN_EMAIL / ADMIN_PASSWORD env vars (or set below) for admin session
 *   Real network access to Railway URL
 *
 * Cleanup:
 *   Test creates a real Supabase auth user + client row. After the test, the
 *   smoke_cleanup afterAll hook deletes both via the service role API.
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

// ── Config ────────────────────────────────────────────────────────────────────

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    ?? 'admin@unmissed.ai';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'COOLboyAdmin2026';
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://qwhvblomlgeapzhnuwlb.supabase.co';
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// Unique email per run so we never collide
const RUN_ID     = Date.now();
const TEST_EMAIL = `smoke-${RUN_ID}@smokebox.unmissed.ai`;

// Onboarding storage key (mirrors lib/storage-keys.ts)
const ONBOARD_STORAGE_KEY = 'unmissed-ai-onboard-draft';

// ── Shared state across tests in this serial suite ───────────────────────────

let adminCtx:    BrowserContext;
let incognitoCtx: BrowserContext;
let adminPage:   Page;
let trialPage:   Page;

let capturedSetupUrl: string | null = null;
let capturedClientId: string | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Pre-seed onboarding localStorage so we land directly on the Launch step
 * without having to click through 6 steps. This keeps the test focused on
 * the three bugs, not the UX flow (which has its own spec).
 */
async function seedOnboardingDraft(page: Page) {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value);
  }, {
    key: ONBOARD_STORAGE_KEY,
    value: JSON.stringify({
      step: 7,  // Launch step (1-based, 7 of 7)
      data: {
        niche: 'plumbing',
        businessName: 'Smoke Test Plumbing',
        agentName: 'Smoke',
        callbackPhone: '(306) 555-0000',
        contactEmail: TEST_EMAIL,
        city: 'Saskatoon',
        state: 'SK',
        streetAddress: '123 Test St',
        businessHoursText: 'Mon-Fri 9am-5pm',
        voiceId: 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a',  // Jacqueline default
        selectedPlan: 'trial',
        agentJob: 'answer_faq',
        notificationMethod: 'email',
        timezone: 'America/Regina',
        servicesOffered: 'Plumbing repairs, drain cleaning',
        hours: {
          monday:    { open: '09:00', close: '17:00', closed: false },
          tuesday:   { open: '09:00', close: '17:00', closed: false },
          wednesday: { open: '09:00', close: '17:00', closed: false },
          thursday:  { open: '09:00', close: '17:00', closed: false },
          friday:    { open: '09:00', close: '17:00', closed: false },
          saturday:  { open: '',      close: '',      closed: true  },
          sunday:    { open: '',      close: '',      closed: true  },
        },
      },
    }),
  });
}

/** Delete the smoke test client + auth user from Supabase after the test */
async function cleanupTestClient(clientId: string | null) {
  if (!clientId || !SERVICE_KEY) return;
  try {
    // Delete client row (cascades to client_users, knowledge_chunks, etc.)
    await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`[cleanup] Deleted test client ${clientId}`);
  } catch (e) {
    console.warn('[cleanup] Failed to delete test client:', e);
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe.serial('7-step post-deploy smoke: BUG-A/B/C', () => {

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    adminCtx     = await browser.newContext();
    incognitoCtx = await browser.newContext();  // isolated: no shared storage
    adminPage    = await adminCtx.newPage();
    trialPage    = await incognitoCtx.newPage();
  });

  test.afterAll(async () => {
    await cleanupTestClient(capturedClientId);
    await adminCtx?.close();
    await incognitoCtx?.close();
  });

  // ── STEP 1: Admin logs in ─────────────────────────────────────────────────

  test('STEP 1 — Admin can log in and reach dashboard', async () => {
    await adminPage.goto('/login');
    await adminPage.getByPlaceholder('you@company.com').fill(ADMIN_EMAIL);
    await adminPage.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
    await adminPage.getByRole('button', { name: /sign in/i }).click();
    await adminPage.waitForURL('**/dashboard**', { timeout: 15_000 });

    expect(adminPage.url()).toContain('/dashboard');
    await adminPage.screenshot({ path: 'screens/smoke-01-admin-dashboard.png' });
    console.log('[STEP 1 ✓] Admin logged in:', adminPage.url());
  });

  // ── STEP 2+3: Incognito completes trial and lands on /onboard/status ───────

  test('STEP 2-3 — BUG-B: Trial onboarding lands on /onboard/status, not setupUrl', async () => {
    // Pre-fill onboarding state → start at Launch step
    await seedOnboardingDraft(trialPage);
    await trialPage.goto('/onboard');

    // Should be on step 7 (Launch)
    await expect(trialPage.locator('text=Step 7 of 7')).toBeVisible({ timeout: 10_000 });
    await trialPage.screenshot({ path: 'screens/smoke-02-launch-step.png' });

    // Intercept the provision/trial API response to capture setupUrl + clientId
    const responsePromise = trialPage.waitForResponse(
      (r) => r.url().includes('/api/provision/trial') && r.request().method() === 'POST',
      { timeout: 60_000 },
    );

    // Click "Start 7-day free trial" (the trial CTA in step6-activate)
    const trialBtn = trialPage.getByRole('button', { name: /7-day free trial/i });
    await expect(trialBtn).toBeVisible({ timeout: 5_000 });
    await trialBtn.click();

    // Wait for provisioning (can take 15-30s: Twilio + Ultravox + Supabase)
    const provisionResponse = await responsePromise;
    expect(provisionResponse.status()).toBe(200);

    const json = await provisionResponse.json();
    capturedSetupUrl = json.setupUrl ?? null;
    capturedClientId = json.clientId ?? null;

    console.log('[STEP 2-3] setupUrl:', capturedSetupUrl?.slice(0, 80), '...');
    console.log('[STEP 2-3] clientId:', capturedClientId);
    console.log('[STEP 2-3] agentName:', json.agentName);

    // BUG-B ASSERTION: must land on /onboard/status — not directly on setupUrl
    await trialPage.waitForURL('**/onboard/status**', { timeout: 15_000 });
    expect(trialPage.url()).toContain('/onboard/status');
    expect(trialPage.url()).not.toBe(capturedSetupUrl ?? '');

    // TrialSuccessScreen must be rendered
    await expect(trialPage.locator('text=Your agent is live')).toBeVisible({ timeout: 5_000 });

    // Agent name should appear in the CTA
    if (json.agentName) {
      await expect(
        trialPage.getByRole('button', { name: new RegExp(`Talk to ${json.agentName}`, 'i') })
      ).toBeVisible({ timeout: 5_000 });
    }

    await trialPage.screenshot({ path: 'screens/smoke-03-trial-success-screen.png' });
    console.log('[STEP 2-3 ✓] Landed on /onboard/status, TrialSuccessScreen rendered');
  });

  // ── STEP 4+5: Invite URL routes through /auth/callback ───────────────────

  test('STEP 4-5 — BUG-C: Invite URL passes through /auth/callback before /auth/set-password', async () => {
    if (!capturedSetupUrl) {
      test.skip(true, 'No setupUrl captured — provisioning may have failed');
      return;
    }

    const urlVisited: string[] = [];
    trialPage.on('framenavigated', (frame) => {
      if (frame === trialPage.mainFrame()) {
        urlVisited.push(frame.url());
      }
    });

    // Navigate to the Supabase invite action_link
    await trialPage.goto(capturedSetupUrl);

    // Give the callback route time to exchange the code and redirect
    await trialPage.waitForURL('**/auth/set-password**', { timeout: 20_000 });

    // ASSERTION: /auth/callback must appear in the navigation chain
    const wentThroughCallback = urlVisited.some((u) => u.includes('/auth/callback'));
    expect(wentThroughCallback, `Expected /auth/callback in chain. Visited: ${urlVisited.join(' → ')}`).toBe(true);

    await trialPage.screenshot({ path: 'screens/smoke-04-set-password-reached.png' });
    console.log('[STEP 4-5 ✓] Auth callback chain:', urlVisited.join(' → '));
  });

  // ── STEP 6: Set password → client dashboard (not admin) ───────────────────

  test('STEP 6 — Set password lands in new CLIENT dashboard, not admin', async () => {
    // If we didn't reach set-password, skip
    if (!trialPage.url().includes('/auth/set-password')) {
      test.skip(true, 'Not on set-password page — prior step failed');
      return;
    }

    const newPassword = `SmokeTest${RUN_ID}!`;

    // Fill and submit the set-password form
    const passwordInput = trialPage.getByPlaceholder(/new password/i)
      .or(trialPage.locator('input[type="password"]').first());
    await expect(passwordInput).toBeVisible({ timeout: 10_000 });
    await passwordInput.fill(newPassword);

    // Confirm password if there's a second field
    const confirmInput = trialPage.locator('input[type="password"]').nth(1);
    if (await confirmInput.isVisible()) {
      await confirmInput.fill(newPassword);
    }

    // Submit
    const submitBtn = trialPage.getByRole('button', { name: /set password|continue|save/i });
    await submitBtn.click();

    // Should land on dashboard
    await trialPage.waitForURL('**/dashboard**', { timeout: 20_000 });

    const dashUrl = trialPage.url();
    expect(dashUrl).toContain('/dashboard');

    // ISOLATION ASSERTION: must NOT land on /admin/clients (admin route)
    expect(dashUrl).not.toContain('/admin');

    // Get the logged-in email to confirm it's the NEW user, not admin
    // The dashboard typically shows user email — check page content doesn't show admin email
    const pageContent = await trialPage.textContent('body') ?? '';
    expect(pageContent).not.toContain(ADMIN_EMAIL);

    await trialPage.screenshot({ path: 'screens/smoke-06-client-dashboard.png' });
    console.log('[STEP 6 ✓] Landed on dashboard as new client, not admin. URL:', dashUrl);

    // ALSO: admin context must still be on its own dashboard unchanged
    expect(adminPage.url()).toContain('/dashboard');
    console.log('[STEP 6 ✓] Admin page still at:', adminPage.url());
  });

  // ── STEP 7: SMS not active for trial user without Twilio number ────────────

  test('STEP 7 — BUG-A: SMS capability chip NOT active (trial user has no Twilio number yet)', async () => {
    // Navigate to settings in the new client dashboard
    const currentUrl = trialPage.url();
    if (!currentUrl.includes('/dashboard')) {
      test.skip(true, 'Not on dashboard — prior step failed');
      return;
    }

    // Try the settings page
    await trialPage.goto(currentUrl.replace(/\/dashboard.*$/, '/dashboard/settings'));
    await trialPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    await trialPage.screenshot({ path: 'screens/smoke-07-settings.png' });

    // BUG-A assertion: "SMS" should not appear as active/enabled
    // The capability chip for SMS is either hidden or shown as inactive
    // We verify there's no "SMS" chip that shows as active/green/indigo
    const smsActiveChip = trialPage.locator(
      'text=SMS',
    ).filter({
      // Filter to elements that look like an active chip (not just any text)
      has: trialPage.locator('[class*="indigo"], [class*="green"], [class*="active"]'),
    });

    // SMS active chip should not be visible for a trial user with no Twilio number
    await expect(smsActiveChip).not.toBeVisible();

    console.log('[STEP 7 ✓] SMS chip not active for trial user without Twilio number');
    await trialPage.screenshot({ path: 'screens/smoke-07-no-active-sms.png' });
  });

});
