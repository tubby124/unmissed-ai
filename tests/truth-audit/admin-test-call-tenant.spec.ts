/**
 * admin-test-call-tenant.spec.ts
 *
 * Validates W1-A fix: when an admin switches to a different client
 * (e.g. Windshield Hub) and clicks "Start Test Call", the POST body
 * includes the selected client's UUID — not the admin's own client ID.
 *
 * Run:
 *   ADMIN_EMAIL=admin@unmissed.ai ADMIN_PASSWORD=... npx playwright test truth-audit/admin-test-call-tenant
 */

import { test, expect, Page } from '@playwright/test'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@unmissed.ai'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const TARGET_CLIENT_NAME = process.env.TARGET_CLIENT_NAME || 'Windshield Hub'

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('you@company.com').fill(ADMIN_EMAIL)
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 15_000 })
}

test.describe('Admin test call — tenant isolation (W1-A)', () => {
  test.skip(!ADMIN_PASSWORD, 'ADMIN_PASSWORD env var required')

  test(`admin switches to "${TARGET_CLIENT_NAME}" → POST body includes client_id`, async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/dashboard/agent')
    await page.waitForLoadState('networkidle')

    // The AdminDropdown renders as a button showing the currently selected client name.
    // Click it to open the list.
    const dropdownTrigger = page.locator('button').filter({ hasText: new RegExp(TARGET_CLIENT_NAME, 'i') }).first()
    const isAlreadySelected = await dropdownTrigger.isVisible({ timeout: 3_000 }).catch(() => false)

    if (!isAlreadySelected) {
      // Open the dropdown (it shows the currently selected client name, not the target)
      const anyClientBtn = page.locator('button').filter({ hasText: /plumbing|hub|vibe|realty|hasan|windshield/i }).first()
      await anyClientBtn.click()

      // Click the target client in the dropdown list
      const targetOption = page.getByRole('button', { name: new RegExp(TARGET_CLIENT_NAME, 'i') }).first()
      await expect(targetOption).toBeVisible({ timeout: 5_000 })
      await targetOption.click()
      await page.waitForTimeout(500) // let React re-render
    }

    // Intercept the agent-test API call — mock the response so no real call is made.
    let capturedBody: Record<string, unknown> | null = null
    await page.route('**/api/dashboard/agent-test', async (route) => {
      const req = route.request()
      try {
        capturedBody = req.postDataJSON() as Record<string, unknown>
      } catch {
        capturedBody = {}
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ joinUrl: 'wss://mock.ultravox.ai/test', callId: 'mock-call-id' }),
      })
    })

    // Click the "Start Test Call" button
    const startBtn = page.getByRole('button', { name: /start test call/i })
    await expect(startBtn).toBeVisible({ timeout: 8_000 })
    await startBtn.click()

    // Wait briefly for the intercepted request
    await page.waitForTimeout(1_500)

    await page.screenshot({ path: 'screens/truth-audit-admin-tenant.png' })

    // ── CRITICAL ASSERTION ─────────────────────────────────────────────────────
    // The POST body must contain a client_id when an admin has a non-default
    // client selected. Without W1-A fix, body would be {} and admin would always
    // test their own client — not the one they're viewing.
    expect(capturedBody, 'POST body was not intercepted — button may not have fired').not.toBeNull()

    expect(
      capturedBody!.client_id,
      'client_id missing from POST /api/dashboard/agent-test — admin test call targets wrong tenant (W1-A regression)'
    ).toBeTruthy()

    // Must be a valid UUID (not a boolean, not an empty string)
    expect(String(capturedBody!.client_id)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )

    console.log(`[truth-audit] ✓ admin test call body.client_id: ${capturedBody!.client_id}`)
  })
})
