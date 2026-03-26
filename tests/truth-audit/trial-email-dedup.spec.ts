/**
 * trial-email-dedup.spec.ts
 *
 * Validates W1-B fix: when a trial signup uses an email that already exists
 * in Supabase Auth, POST /api/provision/trial returns 409 with a clear error
 * message instead of an unhandled 500.
 *
 * Requires a Supabase service role key to seed the existing auth user.
 * The test creates a minimal stub in `clients` table, provisions with same
 * email, expects 409, then cleans up.
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx playwright test truth-audit/trial-email-dedup
 */

import { test, expect } from '@playwright/test'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qwhvblomlgeapzhnuwlb.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const SEED_EMAIL = `truth-audit-dedup-${Date.now()}@example.com`
let seededUserId: string | null = null

test.describe('Trial email dedup — W1-B', () => {
  test.skip(!SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY env var required')

  test.beforeAll(async ({ request }) => {
    // Create an auth user with this email via Supabase Admin API
    const res = await request.post(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        email: SEED_EMAIL,
        password: 'DeduP!2026test',
        email_confirm: true,
      },
    })

    if (res.ok()) {
      const json = await res.json()
      seededUserId = json.id ?? null
    }
    // If user creation fails (already exists), that's fine — test still validates 409
  })

  test.afterAll(async ({ request }) => {
    if (!seededUserId) return
    // Delete the seeded auth user
    await request.delete(`${SUPABASE_URL}/auth/v1/admin/users/${seededUserId}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    })
  })

  test('second trial signup with same email returns 409', async ({ request }) => {
    const body = {
      businessName: 'Dedup Test Business',
      ownerName: 'Dedup Tester',
      email: SEED_EMAIL,
      phone: '+16045559999',
      niche: 'auto_glass',
      callerAutoText: false,
      afterHoursBehavior: 'message',
      notificationMethod: 'none',
      callHandlingMode: 'basic',
      businessHoursWeekday: '9:00 AM - 5:00 PM',
      businessHoursWeekend: 'Closed',
      timezone: 'America/Vancouver',
      selectedPlan: 'lite',
    }

    const res = await request.post('/api/provision/trial', {
      data: body,
      headers: { 'Content-Type': 'application/json' },
    })

    // ── CRITICAL ASSERTION ──────────────────────────────────────────────────
    // W1-B fix: duplicate email must return 409, not 500
    expect(
      res.status(),
      `Expected 409 for duplicate email "${SEED_EMAIL}" but got ${res.status()} — W1-B regression`
    ).toBe(409)

    const json = await res.json().catch(() => ({}))
    expect(
      json.error,
      '409 response must include a user-readable error message'
    ).toBeTruthy()

    // Should tell user to log in, not just say "conflict"
    expect(
      String(json.error).toLowerCase(),
      'error message should mention logging in'
    ).toMatch(/log in|sign in|already exists/i)

    console.log(`[truth-audit] ✓ duplicate email 409: "${json.error}"`)
  })
})
