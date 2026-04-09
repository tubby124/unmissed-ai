/**
 * hand-tuned-gate.test.ts — Phase E.5 Wave 7 regression guard
 *
 * Pins the hand_tuned safety gate behavior in POST /api/dashboard/regenerate-prompt.
 * Founding-4 clients (hasan-sharif, exp-realty, urban-vibe, windshield-hub) have
 * hand_tuned=true in Supabase so their hand-crafted prompts cannot be clobbered
 * by the dashboard sync button or an owner-triggered regenerate.
 *
 * The 409 branch in route.ts delegates to shouldBlockHandTunedRegen, which this
 * test locks. If the predicate changes, this test fails and the route drift is
 * caught before deploy.
 *
 * Run: npx tsx --test src/lib/__tests__/hand-tuned-gate.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { shouldBlockHandTunedRegen } from '../../app/api/dashboard/regenerate-prompt/route.js'

describe('Phase E.5 Wave 7 — shouldBlockHandTunedRegen', () => {
  test('hand_tuned=true + force=false → blocks (409)', () => {
    assert.equal(shouldBlockHandTunedRegen(true, false), true)
  })

  test('hand_tuned=true + force=true → allows (admin override)', () => {
    assert.equal(shouldBlockHandTunedRegen(true, true), false)
  })

  test('hand_tuned=false + force=false → allows (normal regen)', () => {
    assert.equal(shouldBlockHandTunedRegen(false, false), false)
  })

  test('hand_tuned=false + force=true → allows (force is a no-op when no gate)', () => {
    assert.equal(shouldBlockHandTunedRegen(false, true), false)
  })

  test('hand_tuned=null → allows (existing rows without the column populated)', () => {
    assert.equal(shouldBlockHandTunedRegen(null, false), false)
  })

  test('hand_tuned=undefined → allows (missing field)', () => {
    assert.equal(shouldBlockHandTunedRegen(undefined, false), false)
  })
})
