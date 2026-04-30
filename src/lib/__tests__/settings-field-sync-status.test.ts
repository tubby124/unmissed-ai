/**
 * settings-field-sync-status.test.ts — D449 Phase 1
 *
 * Pure-function tests for the per-field sync status mapper. No Supabase, no
 * Ultravox, no fetch — these run in isolation and verify that the legacy
 * monolithic-prompt no-op surfaces as a per-field error chip, not just the
 * page-level D369 banner.
 *
 * Run: npx tsx --test src/lib/__tests__/settings-field-sync-status.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { buildFieldSyncStatus } from '../settings-field-sync-status.js'

const LEGACY_NOOP =
  'Old-format prompt without section markers — use patchers instead of regeneration'

// ── Legacy-prompt-noop expansion of niche_custom_variables ──────────────────────

describe('buildFieldSyncStatus — legacy-prompt-noop on niche_custom_variables', () => {
  test('expands JSONB parent into per-variable error entries', () => {
    const out = buildFieldSyncStatus({
      updates: {
        niche_custom_variables: { GREETING_LINE: 'hi', AGENT_NAME: 'Aisha' },
      },
      regenAlreadySynced: false,
      // Even though the route may report ultravox_synced=true (the DB write
      // succeeded and updateAgent ran on the unchanged prompt), the per-field
      // truth is that GREETING_LINE didn't propagate.
      ultravox_synced: true,
      slotRegenError: LEGACY_NOOP,
      nicheCustomVariablesUpdate: { GREETING_LINE: 'hi', AGENT_NAME: 'Aisha' },
    })

    assert.deepEqual(out.GREETING_LINE, {
      status: 'error',
      reason: 'legacy_prompt_patcher_noop',
    })
    assert.deepEqual(out.AGENT_NAME, {
      status: 'error',
      reason: 'legacy_prompt_patcher_noop',
    })
    // The parent key MUST NOT appear with its own status — the chip is supposed
    // to pin to the variable name (GREETING_LINE), not the JSON blob.
    assert.equal(out.niche_custom_variables, undefined)
  })

  test('flags city as legacy-noop when the regen marker fires', () => {
    const out = buildFieldSyncStatus({
      updates: { city: 'Calgary' },
      regenAlreadySynced: false,
      ultravox_synced: true,
      slotRegenError: LEGACY_NOOP,
    })
    assert.deepEqual(out.city, {
      status: 'error',
      reason: 'legacy_prompt_patcher_noop',
    })
  })
})

// ── Ultravox 5xx classification ─────────────────────────────────────────────────

describe('buildFieldSyncStatus — ultravox_error classification', () => {
  test('classifies 5xx error messages as ultravox_5xx', () => {
    const out = buildFieldSyncStatus({
      updates: { forwarding_number: '+15551234567' },
      regenAlreadySynced: false,
      ultravox_synced: false,
      ultravox_error: 'Ultravox PATCH failed: 503 Service Unavailable',
    })
    assert.deepEqual(out.forwarding_number, {
      status: 'error',
      reason: 'ultravox_5xx',
    })
  })

  test('falls back to unknown when error message has no 5xx code', () => {
    const out = buildFieldSyncStatus({
      updates: { forwarding_number: '+15551234567' },
      regenAlreadySynced: false,
      ultravox_synced: false,
      ultravox_error: 'connect ECONNREFUSED',
    })
    assert.deepEqual(out.forwarding_number, {
      status: 'error',
      reason: 'unknown',
    })
  })

  test('does not flag DB-only fields when ultravox failed', () => {
    // sms_template is DB_ONLY — ultravox_error shouldn't bleed onto it.
    const out = buildFieldSyncStatus({
      updates: { sms_template: 'Thanks for calling' },
      regenAlreadySynced: false,
      ultravox_synced: false,
      ultravox_error: 'Ultravox PATCH failed: 503 Service Unavailable',
    })
    assert.deepEqual(out.sms_template, { status: 'skipped' })
  })
})

// ── Success and skip paths ──────────────────────────────────────────────────────

describe('buildFieldSyncStatus — success and skip paths', () => {
  test('marks fields success when sync ran cleanly', () => {
    const out = buildFieldSyncStatus({
      updates: { forwarding_number: '+15551234567' },
      regenAlreadySynced: false,
      ultravox_synced: true,
    })
    assert.deepEqual(out.forwarding_number, { status: 'success' })
  })

  test('marks fields success when slot regen short-circuited the sync', () => {
    const out = buildFieldSyncStatus({
      updates: {
        niche_custom_variables: { GREETING_LINE: 'hi' },
      },
      regenAlreadySynced: true,
      ultravox_synced: true,
      nicheCustomVariablesUpdate: { GREETING_LINE: 'hi' },
    })
    assert.deepEqual(out.GREETING_LINE, { status: 'success' })
  })

  test('marks DB-only fields as skipped (no sync path triggered)', () => {
    const out = buildFieldSyncStatus({
      updates: { telegram_style: 'compact' },
      regenAlreadySynced: false,
      ultravox_synced: true,
    })
    assert.deepEqual(out.telegram_style, { status: 'skipped' })
  })
})

// ── Empty / edge-case inputs ────────────────────────────────────────────────────

describe('buildFieldSyncStatus — edge cases', () => {
  test('returns empty object when updates is empty', () => {
    const out = buildFieldSyncStatus({
      updates: {},
      regenAlreadySynced: false,
      ultravox_synced: true,
    })
    assert.deepEqual(out, {})
  })

  test('niche_custom_variables without payload yields no entries', () => {
    // Defensive: route should always pass the body's NCV when the updates dict
    // contains the key, but if it's missing we just produce no per-variable
    // entries rather than synthesizing a parent-key fallback.
    const out = buildFieldSyncStatus({
      updates: { niche_custom_variables: { GREETING_LINE: 'hi' } },
      regenAlreadySynced: false,
      ultravox_synced: true,
      slotRegenError: LEGACY_NOOP,
    })
    assert.equal(out.niche_custom_variables, undefined)
    assert.equal(out.GREETING_LINE, undefined)
  })
})
