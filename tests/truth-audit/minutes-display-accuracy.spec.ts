/**
 * minutes-display-accuracy.spec.ts
 *
 * Validates that the minutes usage displayed on the dashboard matches the
 * value returned by the home API (which is Math.ceil(seconds_used / 60)).
 *
 * Two checks:
 * 1. home API returns numeric minutesUsed (not null/NaN)
 * 2. The dashboard page shows a string that includes the same minutesUsed value
 *
 * Run:
 *   TEST_PASSWORD=... npx playwright test truth-audit/minutes-display-accuracy
 */

import { test, expect, Page } from '@playwright/test'

const EMAIL = process.env.TEST_EMAIL || 'e2etest@unmissed.ai'
const PASSWORD = process.env.TEST_PASSWORD || ''

async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('you@company.com').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 15_000 })
}

test.describe('Minutes display accuracy (W2-B alignment)', () => {
  test.skip(!PASSWORD, 'TEST_PASSWORD env var required')

  test('home API minutesUsed is numeric and non-negative', async ({ page }) => {
    await login(page)

    const res = await page.request.get('/api/dashboard/home')
    expect(res.ok(), `home API returned ${res.status()}`).toBe(true)
    const home = await res.json()

    expect(home.usage, 'usage object missing from home API').toBeTruthy()

    const { minutesUsed, minuteLimit, totalAvailable } = home.usage

    expect(typeof minutesUsed, 'minutesUsed should be a number').toBe('number')
    expect(minutesUsed, 'minutesUsed should be >= 0').toBeGreaterThanOrEqual(0)
    expect(minutesUsed % 1, 'minutesUsed should be a whole number (Math.ceil)').toBe(0)

    expect(typeof minuteLimit, 'minuteLimit should be a number').toBe('number')
    expect(minuteLimit, 'minuteLimit should be > 0').toBeGreaterThan(0)

    expect(typeof totalAvailable, 'totalAvailable should be a number').toBe('number')
    expect(totalAvailable, 'totalAvailable should be >= minuteLimit').toBeGreaterThanOrEqual(minuteLimit)

    console.log(`[truth-audit] ✓ home API usage: ${minutesUsed} / ${minuteLimit} min (totalAvailable=${totalAvailable})`)
  })

  test('dashboard displays minutes matching home API value', async ({ page }) => {
    await login(page)

    // Fetch the authoritative value from the API first
    const apiRes = await page.request.get('/api/dashboard/home')
    expect(apiRes.ok()).toBe(true)
    const home = await apiRes.json()
    const { minutesUsed, minuteLimit } = home.usage

    // Navigate to the dashboard where minutes are displayed
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'screens/truth-audit-minutes.png' })

    const pageContent = await page.content()

    // ── CRITICAL ASSERTION ──────────────────────────────────────────────────
    // The dashboard must show minutesUsed as a number somewhere.
    // MinuteUsage component renders: "{minutesUsed} / {minuteLimit} min" or similar.
    // We check that minutesUsed appears in the rendered content.

    // Handle the zero case: "0" always present, so check for context-aware match
    if (minutesUsed === 0) {
      // When 0 minutes used, look for the minuteLimit which is always shown
      expect(
        pageContent,
        `Dashboard should show minuteLimit (${minuteLimit}) in minutes display`
      ).toContain(String(minuteLimit))
    } else {
      // Non-zero: the specific minutesUsed number must appear
      expect(
        pageContent,
        `Dashboard should show minutesUsed=${minutesUsed} but it was not found in page content — minutes display may be inaccurate`
      ).toContain(String(minutesUsed))
    }

    // Also check the agent page — MinuteUsage appears there too (W2-B)
    await page.goto('/dashboard/agent')
    await page.waitForLoadState('networkidle')

    const agentContent = await page.content()
    if (minutesUsed > 0) {
      expect(
        agentContent,
        `Agent page should show minutesUsed=${minutesUsed}`
      ).toContain(String(minutesUsed))
    }

    console.log(`[truth-audit] ✓ minutes display: ${minutesUsed} / ${minuteLimit} min matches API`)
  })
})
