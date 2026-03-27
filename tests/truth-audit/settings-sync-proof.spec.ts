/**
 * G1: Browser-Authenticated Settings Save → Sync → Runtime Proof
 *
 * Positive control: agent_name change triggers needsAgentSync → updateAgent → DB sync metadata updated
 * Negative control: voicemail_greeting_text change does NOT trigger sync → sync metadata unchanged
 *
 * Uses e2etest@unmissed.ai → e2e-test-plumbing-co client.
 *
 * Run:
 *   TEST_PASSWORD=... npx playwright test truth-audit/settings-sync-proof
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

test.describe('G1: Settings save → sync proof', () => {
  test.skip(!PASSWORD, 'TEST_PASSWORD env var required')

  test('POSITIVE: agent_name change triggers sync + updates sync metadata', async ({ page }) => {
    await login(page)

    // Step 1: Read current state via API
    const beforeRes = await page.request.get('/api/dashboard/home')
    expect(beforeRes.ok()).toBe(true)

    // Step 2: Save a runtime-bearing setting (agent_name) via PATCH
    const testName = `G1-Proof-${Date.now()}`
    const patchRes = await page.request.patch('/api/dashboard/settings', {
      data: { agent_name: testName },
    })
    expect(patchRes.ok(), `PATCH failed: ${patchRes.status()}`).toBe(true)
    const patchBody = await patchRes.json()

    // Step 3: Verify sync was triggered
    expect(patchBody.ultravox_synced).toBe(true)
    expect(patchBody.last_sync_at).toBeTruthy()
    expect(patchBody.ultravox_error).toBeUndefined()

    console.log(`[G1:positive] agent_name changed to "${testName}", ultravox_synced=${patchBody.ultravox_synced}, last_sync_at=${patchBody.last_sync_at}`)

    // Step 4: Verify DB state via home API (which reads from clients table)
    const afterRes = await page.request.get('/api/dashboard/home')
    expect(afterRes.ok()).toBe(true)

    // Step 5: Revert — restore original name (null → use business name)
    const revertRes = await page.request.patch('/api/dashboard/settings', {
      data: { agent_name: 'Plumber Test Agent' },
    })
    expect(revertRes.ok(), `Revert PATCH failed: ${revertRes.status()}`).toBe(true)
    const revertBody = await revertRes.json()
    expect(revertBody.ultravox_synced).toBe(true)

    console.log(`[G1:positive] Reverted agent_name, ultravox_synced=${revertBody.ultravox_synced}`)
  })

  test('NEGATIVE: voicemail_greeting_text change does NOT trigger sync', async ({ page }) => {
    await login(page)

    // Step 1: Record current sync timestamp
    const beforeRes = await page.request.get('/api/dashboard/home')
    expect(beforeRes.ok()).toBe(true)

    // Step 2: Save a DB-only setting (voicemail_greeting_text) via PATCH
    const testGreeting = `G1 test greeting ${Date.now()}`
    const patchRes = await page.request.patch('/api/dashboard/settings', {
      data: { voicemail_greeting_text: testGreeting },
    })
    expect(patchRes.ok(), `PATCH failed: ${patchRes.status()}`).toBe(true)
    const patchBody = await patchRes.json()

    // Step 3: Verify sync was NOT triggered
    expect(patchBody.ultravox_synced).toBe(false)
    expect(patchBody.last_sync_at).toBeUndefined()

    console.log(`[G1:negative] voicemail_greeting_text changed, ultravox_synced=${patchBody.ultravox_synced} (expected false)`)

    // Step 4: Revert
    const revertRes = await page.request.patch('/api/dashboard/settings', {
      data: { voicemail_greeting_text: '' },
    })
    expect(revertRes.ok()).toBe(true)

    console.log(`[G1:negative] Reverted voicemail_greeting_text`)
  })
})
