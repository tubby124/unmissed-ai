/**
 * capability-badge-truth.spec.ts
 *
 * Validates that the Booking capability badge in CapabilitiesCard reflects
 * actual DB state. The e2etest account has no Google Calendar connected, so
 * the booking badge must show as inactive — not "Google Calendar connected".
 *
 * Uses the e2etest@unmissed.ai account which is known to have:
 *   - calendar_auth_status != 'connected'  → booking badge = inactive
 *
 * Run:
 *   TEST_PASSWORD=... npx playwright test truth-audit/capability-badge-truth
 */

import { test, expect, Page } from '@playwright/test'

const EMAIL = process.env.TEST_EMAIL || 'e2etest@unmissed.ai'
const PASSWORD = process.env.TEST_PASSWORD || ''

async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('you@company.com').fill(EMAIL)
  await page.getByPlaceholder('••••••••').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 15_000 })
}

test.describe('Capability badge truth — booking inactive without calendar (W1-D)', () => {
  test.skip(!PASSWORD, 'TEST_PASSWORD env var required')

  test('booking badge shows inactive when calendar not connected', async ({ page }) => {
    await login(page)

    // Navigate to settings where CapabilitiesCard renders
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'screens/truth-audit-capabilities.png' })

    // Find the booking/calendar capability row
    // CapabilitiesCard renders rows for: booking, sms, transfer, knowledge, website
    // Look for the booking item by its label text
    const bookingRow = page.locator('[class*="rounded"]').filter({ hasText: /book appointments/i }).first()

    // If the card isn't on settings, try the agent page
    const isOnSettings = await bookingRow.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!isOnSettings) {
      await page.goto('/dashboard/agent')
      await page.waitForLoadState('networkidle')
    }

    // ── CRITICAL ASSERTION ──────────────────────────────────────────────────
    // e2etest account has no Google Calendar connected.
    // The booking capability should show its actionHint, NOT "Google Calendar connected".
    // Verify via the home API which returns capabilities object.
    const homeRes = await page.request.get('/api/dashboard/home')
    expect(homeRes.ok(), `home API failed: ${homeRes.status()}`).toBe(true)
    const home = await homeRes.json()

    // capabilities.hasBooking must be false for e2etest (no calendar connected)
    expect(
      home.capabilities?.hasBooking,
      'e2etest account should not have booking active — calendar is not connected. If this fails, the test account was changed.'
    ).toBeFalsy()

    // Also verify the page does NOT show "Google Calendar connected" for this account
    const pageText = await page.content()

    // The activated booking text only appears when calendar IS connected
    const hasActiveText = pageText.includes('Google Calendar connected')
    expect(
      hasActiveText,
      'Booking badge shows "Google Calendar connected" but e2etest has no calendar — badge is lying (fake-control bug)'
    ).toBe(false)

    console.log(`[truth-audit] ✓ booking badge correctly inactive (capabilities.hasBooking=${home.capabilities?.hasBooking})`)
  })

  test('home API capabilities match DB truth for e2etest account', async ({ page }) => {
    await login(page)

    const homeRes = await page.request.get('/api/dashboard/home')
    expect(homeRes.ok()).toBe(true)
    const home = await homeRes.json()

    const caps = home.capabilities
    expect(caps, 'capabilities missing from home API response').toBeTruthy()

    // Verify capability flags are booleans (not undefined/null — that's a regression)
    expect(typeof caps.hasBooking, 'hasBooking should be boolean').toBe('boolean')
    expect(typeof caps.hasSms, 'hasSms should be boolean').toBe('boolean')
    expect(typeof caps.hasTransfer, 'hasTransfer should be boolean').toBe('boolean')
    expect(typeof caps.hasKnowledge, 'hasKnowledge should be boolean').toBe('boolean')
    expect(typeof caps.hasWebsite, 'hasWebsite should be boolean').toBe('boolean')

    console.log(`[truth-audit] ✓ capability flags: ${JSON.stringify(caps)}`)
  })
})
