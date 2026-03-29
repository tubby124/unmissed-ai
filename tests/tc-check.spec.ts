import { test, expect } from '@playwright/test'

test('True Color — login + dashboard check', async ({ page }) => {
  await page.goto('http://localhost:3000/login')
  await page.fill('input[type="email"]', 'info@true-color.ca')
  await page.locator('input[type="password"]').fill('qwerty123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 15000 })
  console.log('Landed on:', page.url())

  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/tmp/tc-home.png', fullPage: true })

  // Check for mode switcher on home
  const modeSwitcherVisible = await page.locator('text=How should your agent handle calls').isVisible().catch(() => false)
  console.log('TrialModeSwitcher visible on home:', modeSwitcherVisible)

  // Settings page
  await page.goto('http://localhost:3000/dashboard/settings')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/tmp/tc-settings.png', fullPage: true })

  const modeCard = await page.locator('text=Call Handling Mode').first().isVisible().catch(() => false)
  console.log('CallHandlingModeCard visible in settings:', modeCard)

  // Check current mode shown
  const activeMode = await page.locator('[data-active="true"], .border-primary').first().textContent().catch(() => 'not found')
  console.log('Active mode element text:', activeMode)
})
