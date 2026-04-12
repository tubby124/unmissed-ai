/**
 * Phase 4 — Settings Pipeline E2E
 *
 * Verifies the full chain for PROMPT_AFFECTING fields:
 *   UI change → PATCH fires → DB updated → system_prompt patched → Ultravox synced
 *
 * Requires:
 *   ADMIN_EMAIL     — defaults to admin@unmissed.ai
 *   ADMIN_PASSWORD  — set in .env.local
 *   SUPABASE_URL    — defaults to prod
 *   SUPABASE_SECRET_KEY — service role key for direct DB verification
 *
 * Run: ADMIN_PASSWORD=... SUPABASE_SECRET_KEY=... npx playwright test tests/phase4-settings-e2e.spec.ts
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import https from 'https';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'hasan.sharif.realtor@gmail.com';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qwhvblomlgeapzhnuwlb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || '';

// ─── Supabase helper (direct REST — bypasses auth, verifies DB truth) ─────────

async function sbGet(request: APIRequestContext, path: string) {
  const res = await request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return res.json();
}

async function getClient(request: APIRequestContext, clientId: string) {
  const rows = await sbGet(
    request,
    `clients?id=eq.${clientId}&select=id,slug,business_name,agent_name,system_prompt,last_agent_sync_status,last_agent_sync_at,outbound_enabled,outbound_number,outbound_time_window_start,outbound_time_window_end,timezone,hand_tuned`,
  );
  return rows[0] ?? null;
}

// Find a non-hand_tuned active client safe to use for patching tests
async function findTestClient(request: APIRequestContext) {
  const rows = await sbGet(
    request,
    `clients?status=eq.active&hand_tuned=is.false&select=id,slug,business_name,agent_name,system_prompt,last_agent_sync_status,timezone,outbound_enabled&limit=3`,
  );
  return rows[0] ?? null;
}

// ─── Login helper — sets Supabase session cookies directly ───────────────────
// Admin magic links use implicit flow (no PKCE code_verifier), so navigating
// the browser to the verify URL redirects with #access_token in the hash.
// The homepage has no auth listener, so the hash is never processed.
// Solution: GET the verify URL server-side (no redirect follow) to capture the
// Location header, extract tokens, build the @supabase/ssr session cookie, and
// inject it into the browser context so the Next.js middleware sees it.

const BASE_URL = process.env.BASE_URL || 'https://unmissed-ai-production.up.railway.app';
const SUPABASE_PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

/** GET a URL without following redirects; returns the Location header value */
function getRedirectLocation(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'GET' },
      (res) => { resolve(res.headers['location'] ?? ''); res.resume(); },
    );
    req.on('error', reject);
    req.end();
  });
}

async function loginAsAdmin(page: Page, request: APIRequestContext) {
  // 1. Generate magic link (implicit flow — no PKCE code_challenge from admin API)
  const linkRes = await request.post(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    data: { type: 'magiclink', email: ADMIN_EMAIL, redirect_to: BASE_URL },
  });
  const linkJson = await linkRes.json();
  const actionLink: string = linkJson.action_link ?? '';
  if (!actionLink) throw new Error(`Magic link failed: ${JSON.stringify(linkJson)}`);

  // 2. Exchange OTP for tokens: GET verify URL server-side, capture Location header
  const location = await getRedirectLocation(actionLink);
  if (!location) throw new Error(`No redirect Location from verify URL`);

  const hashIdx = location.indexOf('#');
  if (hashIdx === -1) throw new Error(`No hash in redirect location: ${location}`);
  const params = new URLSearchParams(location.slice(hashIdx + 1));
  const accessToken = params.get('access_token') ?? '';
  const refreshToken = params.get('refresh_token') ?? '';
  const expiresIn = parseInt(params.get('expires_in') ?? '3600', 10);
  if (!accessToken) throw new Error(`No access_token in redirect: ${location}`);

  // 3. Fetch the full user object (session cookie requires it)
  const userRes = await request.get(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
  });
  const user = await userRes.json();

  // 4. Build the session JSON that @supabase/ssr expects
  const session = {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: refreshToken,
    user,
  };
  const sessionStr = JSON.stringify(session);

  // 5. Load app root (sets origin for cookie scoping), then inject session cookie
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  const cookieName = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
  const domain = new URL(BASE_URL).hostname;
  const cookieBase = {
    domain,
    path: '/',
    sameSite: 'Lax' as const,
    httpOnly: false,
    expires: Math.floor(Date.now() / 1000) + 400 * 24 * 60 * 60,
  };

  // @supabase/ssr chunks cookies > 3180 encoded chars
  const encoded = encodeURIComponent(sessionStr);
  if (encoded.length <= 3180) {
    await page.context().addCookies([{ name: cookieName, value: sessionStr, ...cookieBase }]);
  } else {
    const cookies: { name: string; value: string }[] = [];
    let remaining = encoded;
    let i = 0;
    while (remaining.length > 0) {
      let head = remaining.slice(0, 3180);
      const lastPct = head.lastIndexOf('%');
      if (lastPct > 3177) head = head.slice(0, lastPct);
      let value = '';
      while (head.length > 0) {
        try { value = decodeURIComponent(head); break; }
        catch { head = head.slice(0, head.length - 3); }
      }
      cookies.push({ name: `${cookieName}.${i}`, value });
      remaining = remaining.slice(encodeURIComponent(value).length);
      i++;
    }
    await page.context().addCookies(cookies.map((c) => ({ ...c, ...cookieBase })));
  }

  // 6. Navigate to dashboard — middleware reads cookies → authenticated ✅
  await page.goto('/dashboard');
  await page.waitForURL('**/dashboard**', { timeout: 20_000 });
}

// ─── Guard — skip entire suite if creds not provided ─────────────────────────

test.describe('Phase 4 — Settings Pipeline E2E', () => {
  test.skip(!SUPABASE_KEY, 'SUPABASE_SECRET_KEY required');
  test.setTimeout(90_000); // UI + network tests need more time

  // ── 1. Agent name change → DB update ──────────────────────────────────────
  // AgentOverviewCard: controlled input with placeholder "e.g. Aisha".
  // Save fires only when user clicks the "Save changes" footer button (not on blur).

  test('agent_name change patches DB and prompt', async ({ page, request }) => {
    const client = await findTestClient(request);
    if (!client) test.skip(true, 'No non-hand_tuned active client found');

    const original = client.agent_name ?? 'Agent';
    const testName = `E2E-${Date.now() % 100000}`;

    await loginAsAdmin(page, request);
    await page.goto(`/dashboard/settings?client_id=${client.id}`);
    await page.waitForLoadState('networkidle');

    // Register PATCH listener before triggering the save
    const patchDone = page.waitForResponse(
      (r) => r.url().includes('/api/dashboard/settings') && r.request().method() === 'PATCH',
      { timeout: 15_000 },
    );

    // AgentOverviewCard input: controlled, placeholder "e.g. Aisha"
    const nameInput = page.locator('input[placeholder="e.g. Aisha"]').first();
    await nameInput.fill(testName);

    // Footer appears only when dirty — click "Save changes"
    await page.getByRole('button', { name: 'Save changes' }).click();

    const patchRes = await patchDone;
    expect(patchRes.status()).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody).not.toHaveProperty('error');

    await page.screenshot({ path: 'screens/p4-agent-name-saved.png' });

    // Verify DB
    await page.waitForTimeout(2000);
    const after = await getClient(request, client.id);
    expect(after.agent_name).toBe(testName);

    // Restore original
    await nameInput.fill(original);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForTimeout(1500);
  });

  // ── 2. Outbound toggle → DB write ─────────────────────────────────────────
  // OutboundSchedulingCard: toggle is a plain <button> (no role="switch").
  // PATCH only fires on explicit "Save Outbound Settings" button click — not on toggle.

  test('outbound_enabled toggle persists to DB', async ({ page, request }) => {
    const client = await findTestClient(request);
    if (!client) test.skip(true, 'No non-hand_tuned active client found');

    await loginAsAdmin(page, request);
    await page.goto(`/dashboard/actions?client_id=${client.id}`);
    await page.waitForLoadState('networkidle');

    const before = await getClient(request, client.id);
    const wasEnabled = before.outbound_enabled ?? false;

    // OutboundSchedulingCard: find by card heading, get the inline toggle button
    // Structure: div.rounded-2xl > div.flex.justify-between > p "Outbound Calling" + button (toggle)
    const outboundCard = page.locator('.rounded-2xl').filter({ hasText: /Outbound Calling/i }).first();
    const visible = await outboundCard.isVisible().catch(() => false);
    if (!visible) {
      await page.screenshot({ path: 'screens/p4-outbound-card-missing.png' });
      console.log('OutboundSchedulingCard not visible on /dashboard/actions');
      return;
    }

    // The toggle is the first <button> in the card header row (inline-flex rounded-full)
    const toggleBtn = outboundCard.locator('div').filter({ hasText: /^Outbound Calling/ }).locator('button').first();

    // Click toggle (local state change only — no PATCH yet)
    await toggleBtn.click();

    // PATCH fires on "Save Outbound Settings" click — register listener first
    const patchDone = page.waitForResponse(
      (r) => r.url().includes('/api/dashboard/settings') && r.request().method() === 'PATCH',
      { timeout: 10_000 },
    );
    await outboundCard.getByRole('button', { name: /Save Outbound Settings/i }).click();

    const patchRes = await patchDone;
    expect(patchRes.status()).toBe(200);

    await page.waitForTimeout(1500);
    const after = await getClient(request, client.id);
    expect(after.outbound_enabled).toBe(!wasEnabled);

    // Restore: toggle back + save
    await toggleBtn.click();
    const patchDone2 = page.waitForResponse(
      (r) => r.url().includes('/api/dashboard/settings') && r.request().method() === 'PATCH',
      { timeout: 10_000 },
    );
    await outboundCard.getByRole('button', { name: /Save Outbound Settings/i }).click();
    await patchDone2;

    await page.screenshot({ path: 'screens/p4-outbound-toggle.png' });
  });

  // ── 3. Timezone change → DB write ─────────────────────────────────────────
  // Admin view: timezone is inside GodModeCard ("Advanced Config" section).
  // The non-admin timezone select ({!isAdmin}) is hidden for admin users.
  // GodModeCard requires clicking "Save Config" after changing the select.

  test('timezone selector saves to DB', async ({ page, request }) => {
    const client = await findTestClient(request);
    if (!client) test.skip(true, 'No non-hand_tuned active client found');

    await loginAsAdmin(page, request);
    await page.goto(`/dashboard/settings?client_id=${client.id}`);
    await page.waitForLoadState('networkidle');

    const before = await getClient(request, client.id);
    const originalTz = before.timezone ?? 'America/Edmonton';
    const newTz = originalTz === 'America/Toronto' ? 'America/Vancouver' : 'America/Toronto';

    // GodModeCard (admin-only) has the timezone select
    // Identified by "Advanced Config" heading with amber border styling
    const godModeCard = page.locator('.rounded-2xl').filter({ hasText: /Advanced Config/i }).first();
    const cardVisible = await godModeCard.isVisible().catch(() => false);

    if (!cardVisible) {
      await page.screenshot({ path: 'screens/p4-godmode-missing.png' });
      console.log('GodModeCard not visible — skipping timezone test');
      return;
    }

    // First select inside GodModeCard is the timezone select (Timezone + Monthly Minute Limit grid)
    const tzSelect = godModeCard.locator('select').first();
    await tzSelect.scrollIntoViewIfNeeded();
    await tzSelect.selectOption(newTz);
    // Let React commit the state update before saveConfig() reads the closure value
    await page.waitForTimeout(300);

    // PATCH fires when clicking "Save Config" in GodModeCard
    const saveConfigBtn = godModeCard.getByRole('button', { name: /Save Config/i });
    await saveConfigBtn.scrollIntoViewIfNeeded();
    const patchDone = page.waitForResponse(
      (r) => r.url().includes('/api/dashboard/settings') && r.request().method() === 'PATCH',
      { timeout: 10_000 },
    );
    await saveConfigBtn.click();

    const patchRes = await patchDone;
    expect(patchRes.status()).toBe(200);

    await page.waitForTimeout(1500);
    const after = await getClient(request, client.id);
    expect(after.timezone).toBe(newTz);

    // Restore
    await tzSelect.selectOption(originalTz);
    await page.waitForTimeout(300);
    const patchDone2 = page.waitForResponse(
      (r) => r.url().includes('/api/dashboard/settings') && r.request().method() === 'PATCH',
      { timeout: 10_000 },
    );
    await saveConfigBtn.click();
    await patchDone2;

    await page.screenshot({ path: 'screens/p4-timezone-saved.png' });
  });

  // ── 4. Prompt-affecting save → system_prompt updates + Ultravox syncs ──────
  // Uses agent_name (DB_PLUS_PROMPT, triggersPatch: 'agent_name') — same UI as test 1.
  // Additional assertions: system_prompt contains new name, last_agent_sync_at advances.

  test('PROMPT_AFFECTING field save updates system_prompt and triggers Ultravox sync', async ({ page, request }) => {
    const client = await findTestClient(request);
    if (!client) test.skip(true, 'No non-hand_tuned active client found');

    const before = await getClient(request, client.id);
    const originalName = before.agent_name ?? 'Agent';
    const promptBefore = before.system_prompt ?? '';
    const syncAtBefore = before.last_agent_sync_at ?? '';
    const tempName = `E2E-Sync-${Date.now() % 100000}`;

    await loginAsAdmin(page, request);
    await page.goto(`/dashboard/settings?client_id=${client.id}`);
    await page.waitForLoadState('networkidle');

    // Register PATCH listener before triggering the save
    const patchDone = page.waitForResponse(
      (r) => r.url().includes('/api/dashboard/settings') && r.request().method() === 'PATCH',
      { timeout: 15_000 },
    );

    // AgentOverviewCard: same selector as test 1
    const nameInput = page.locator('input[placeholder="e.g. Aisha"]').first();
    await nameInput.fill(tempName);
    await page.getByRole('button', { name: 'Save changes' }).click();

    const patchRes = await patchDone;
    expect(patchRes.status()).toBe(200);
    const patchJson = await patchRes.json();
    expect(patchJson).not.toHaveProperty('error');

    // Wait for async Ultravox sync to settle (route fires updateAgent after DB write)
    await page.waitForTimeout(4000);

    const after = await getClient(request, client.id);

    // DB updated
    expect(after.agent_name).toBe(tempName);

    // Prompt was patched with new agent name
    if (!before.hand_tuned && promptBefore) {
      expect(after.system_prompt).not.toBe(promptBefore);
      expect(after.system_prompt).toContain(tempName);
    }

    // Ultravox sync fired (last_agent_sync_status and timestamp should update)
    // DB column stores 'success' (not 'ok') per the sync handler
    expect(after.last_agent_sync_status).toBe('success');
    if (syncAtBefore) {
      expect(after.last_agent_sync_at).not.toBe(syncAtBefore);
    }

    await page.screenshot({ path: 'screens/p4-prompt-updated.png' });

    // Restore
    await nameInput.fill(originalName);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForTimeout(2000);
  });

  // ── 5. Existing settings-sync-check (layer 3: DB ↔ Ultravox tools) ────────

  test('DB flags match Ultravox tool registrations (sync-check)', async ({ request }) => {
    // Re-runs the logic from settings-sync-check.sh as an in-process test
    const clients = await sbGet(
      request,
      `clients?status=eq.active&select=slug,booking_enabled,sms_enabled,forwarding_number,system_prompt,ultravox_agent_id&limit=20`,
    );

    const ULTRAVOX_KEY = process.env.ULTRAVOX_API_KEY ?? '';
    if (!ULTRAVOX_KEY) {
      console.log('ULTRAVOX_API_KEY not set — skipping tool registration check');
      return;
    }

    const failures: string[] = [];

    for (const c of clients) {
      if (!c.ultravox_agent_id) continue;

      const agentRes = await request.get(
        `https://api.ultravox.ai/api/agents/${c.ultravox_agent_id}`,
        { headers: { 'X-API-Key': ULTRAVOX_KEY } },
      );
      if (!agentRes.ok()) {
        console.log(`  WARN: ${c.slug} — Ultravox fetch ${agentRes.status()}`);
        continue;
      }
      const agent = await agentRes.json();
      const tools: string[] = [];
      for (const t of agent?.callTemplate?.selectedTools ?? []) {
        if (t.temporaryTool?.modelToolName) tools.push(t.temporaryTool.modelToolName);
        if (t.toolName) tools.push(t.toolName);
      }

      const hasCal = tools.includes('checkCalendarAvailability');
      if (c.booking_enabled && !hasCal)
        failures.push(`${c.slug}: booking_enabled=true but missing checkCalendarAvailability`);
      if (!c.booking_enabled && hasCal)
        failures.push(`${c.slug}: booking_enabled=false but has checkCalendarAvailability`);

      const hasSms = tools.includes('sendTextMessage');
      if (c.sms_enabled && !hasSms)
        failures.push(`${c.slug}: sms_enabled=true but missing sendTextMessage`);

      const hasTransfer = tools.includes('transferCall');
      if (c.forwarding_number && !hasTransfer)
        failures.push(`${c.slug}: forwarding_number set but missing transferCall`);
    }

    if (failures.length > 0) {
      console.error('SYNC MISMATCHES:\n' + failures.map(f => '  ' + f).join('\n'));
    }
    expect(failures).toHaveLength(0);
  });
});
