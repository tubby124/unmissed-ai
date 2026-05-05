import { expect, test, type Page } from '@playwright/test'

const EMAIL = process.env.TEST_EMAIL || 'e2etest@unmissed.ai'
const PASSWORD = process.env.TEST_PASSWORD || ''

async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('you@company.com').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 15_000 })
  await acknowledgeRecordingConsent(page)
}

async function acknowledgeRecordingConsent(page: Page) {
  const dialog = page.getByRole('dialog').filter({ hasText: /recording authorization|one-time confirmation needed/i })
  await dialog.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => null)
  if (!(await dialog.isVisible().catch(() => false))) return

  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: /acknowledge and continue/i }).click()
  await expect(dialog).toBeHidden({ timeout: 5_000 })
}

test.describe('Dashboard trust-core smoke', () => {
  test.skip(!PASSWORD, 'TEST_PASSWORD env var required')

  test('core dashboard pages render without blank/error states', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await login(page)

    for (const path of [
      '/dashboard',
      '/dashboard/settings',
      '/dashboard/calls',
      '/dashboard/knowledge',
      '/dashboard/go-live',
      '/dashboard/agent',
      '/dashboard/notifications',
    ]) {
      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')
      await expect(page.locator('body')).toBeVisible()
      const text = (await page.locator('body').innerText()).trim()
      expect(text.length, `${path} rendered an empty body`).toBeGreaterThan(80)
      expect(text, `${path} rendered a fatal app error`).not.toMatch(/Application error|Unhandled Runtime Error|Something went wrong/i)
    }

    expect(
      consoleErrors.filter(err => !/favicon|ResizeObserver loop|unable to create webgl context/i.test(err)),
      'dashboard pages should not emit browser console errors',
    ).toEqual([])
  })

  test('overview exposes truthful capability setup affordances', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('button', { name: /SMS/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Booking/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Transfer/i }).first()).toBeVisible()

    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/Google Calendar connected/i)
  })
})
