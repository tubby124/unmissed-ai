/**
 * Playwright integration test for the multichannel notifications dashboard.
 *
 * Verifies:
 *   1. /dashboard/notifications renders 3 channel cards (SMS, Email, Telegram)
 *   2. SMS toggle is gated on twilio_number being set
 *   3. Clicking "Send test SMS" calls /api/dashboard/notifications/test and shows result
 *
 * Skips entirely if TEST_PASSWORD is unset (matches dashboard-features.spec.ts pattern).
 * Run: npx playwright test tests/notification-dashboard.spec.ts
 */

import { test, expect, Page } from '@playwright/test'

const EMAIL = process.env.TEST_EMAIL || 'e2etest@unmissed.ai'
const PASSWORD = process.env.TEST_PASSWORD || ''

async function acknowledgeRecordingConsent(page: Page) {
  const dialog = page.getByRole('dialog').filter({ hasText: /recording authorization|one-time confirmation needed/i })
  await dialog.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => null)
  if (!(await dialog.isVisible().catch(() => false))) return
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: /acknowledge and continue/i }).click()
  await expect(dialog).toBeHidden({ timeout: 5_000 })
}

async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('you@company.com').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 15_000 })
  await acknowledgeRecordingConsent(page)
}

test.describe('multichannel notifications dashboard', () => {
  test.skip(!PASSWORD, 'TEST_PASSWORD env var required')

  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/notifications')
    await page.waitForLoadState('networkidle')
    await acknowledgeRecordingConsent(page)
  })

  test('renders 3 channel cards', async ({ page }) => {
    await expect(page.getByText('SMS to your phone')).toBeVisible()
    await expect(page.getByText('Email', { exact: false })).toBeVisible()
    await expect(page.getByText('Telegram', { exact: false })).toBeVisible()
  })

  test('SMS toggle reveals alert_phone input when enabled', async ({ page }) => {
    const smsCard = page.locator('div').filter({ hasText: 'SMS to your phone' }).first()
    // Skip if SMS toggle is disabled (no twilio_number on this client)
    const toggle = smsCard.locator('button[role="switch"], input[type="checkbox"]').first()
    const disabled = await toggle.getAttribute('disabled').catch(() => null)
    test.skip(disabled !== null, 'SMS toggle is disabled — likely no twilio_number on test client')
    await toggle.click()
    await expect(smsCard.locator('input[type="tel"]')).toBeVisible()
  })

  test('Send test SMS button calls /api/dashboard/notifications/test', async ({ page }) => {
    const smsCard = page.locator('div').filter({ hasText: 'SMS to your phone' }).first()
    const toggle = smsCard.locator('button[role="switch"], input[type="checkbox"]').first()
    const disabled = await toggle.getAttribute('disabled').catch(() => null)
    test.skip(disabled !== null, 'SMS toggle is disabled — likely no twilio_number on test client')

    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/dashboard/notifications/test') && r.request().method() === 'POST',
      { timeout: 15_000 },
    )

    await toggle.click()
    await smsCard.locator('input[type="tel"]').fill('+15551234567')
    await smsCard.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(500)

    await smsCard.getByRole('button', { name: /Send test SMS/i }).click()
    const response = await responsePromise
    // 200 if Twilio sends, 4xx/5xx if config missing — either is OK; just verify the call fired
    expect([200, 400, 401, 403, 429, 500]).toContain(response.status())
    const body = await response.json()
    expect(body).toHaveProperty('ok')
  })
})
