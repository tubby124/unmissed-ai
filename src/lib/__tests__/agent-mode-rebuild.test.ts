/**
 * agent-mode-rebuild.test.ts — Phase 4 rebuild helper verification
 *
 * Tests the corrected deriveCallHandlingMode logic:
 *   1. voicemail_replacement always → message_only (regardless of current mode)
 *   2. full_service clients are preserved with non-voicemail overrides
 *   3. triage clients stay triage
 *   4. null/missing current mode defaults to triage
 *   5. message_only current mode → triage when switching to non-voicemail mode
 *      (message_only is not full_service, so no special preservation)
 *
 * Run: npx tsx --test src/lib/__tests__/agent-mode-rebuild.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { deriveCallHandlingMode } from '../agent-mode-rebuild.js'

// ── 1. voicemail_replacement always wins ──────────────────────────────────────

describe('1. voicemail_replacement always → message_only', () => {
  test('voicemail_replacement + triage current → message_only', () => {
    assert.equal(deriveCallHandlingMode('voicemail_replacement', 'triage'), 'message_only')
  })

  test('voicemail_replacement + full_service current → message_only (not preserved)', () => {
    // voicemail_replacement takes priority over full_service preservation
    assert.equal(deriveCallHandlingMode('voicemail_replacement', 'full_service'), 'message_only')
  })

  test('voicemail_replacement + message_only current → message_only', () => {
    assert.equal(deriveCallHandlingMode('voicemail_replacement', 'message_only'), 'message_only')
  })

  test('voicemail_replacement + null current → message_only', () => {
    assert.equal(deriveCallHandlingMode('voicemail_replacement', null), 'message_only')
  })
})

// ── 2. full_service preservation ──────────────────────────────────────────────

describe('2. full_service current mode is preserved with non-voicemail overrides', () => {
  test('info_hub + full_service → full_service preserved', () => {
    assert.equal(
      deriveCallHandlingMode('info_hub', 'full_service'),
      'full_service',
      'Switching an existing booking client to info_hub must not silently remove full_service',
    )
  })

  test('appointment_booking + full_service → full_service preserved', () => {
    assert.equal(deriveCallHandlingMode('appointment_booking', 'full_service'), 'full_service')
  })

  test('lead_capture + full_service → full_service preserved', () => {
    assert.equal(deriveCallHandlingMode('lead_capture', 'full_service'), 'full_service')
  })
})

// ── 3. triage stays triage ────────────────────────────────────────────────────

describe('3. triage current mode stays triage with non-voicemail overrides', () => {
  test('info_hub + triage → triage', () => {
    assert.equal(deriveCallHandlingMode('info_hub', 'triage'), 'triage')
  })

  test('appointment_booking + triage → triage', () => {
    assert.equal(deriveCallHandlingMode('appointment_booking', 'triage'), 'triage')
  })

  test('lead_capture + triage → triage', () => {
    assert.equal(deriveCallHandlingMode('lead_capture', 'triage'), 'triage')
  })
})

// ── 4. null/missing current mode ─────────────────────────────────────────────

describe('4. null current mode defaults to triage', () => {
  test('info_hub + null → triage', () => {
    assert.equal(deriveCallHandlingMode('info_hub', null), 'triage')
  })

  test('appointment_booking + null → triage', () => {
    assert.equal(deriveCallHandlingMode('appointment_booking', null), 'triage')
  })

  test('lead_capture + null → triage', () => {
    assert.equal(deriveCallHandlingMode('lead_capture', null), 'triage')
  })
})

// ── 5. message_only → triage on non-voicemail switch ─────────────────────────

describe('5. message_only current mode becomes triage when switching to non-voicemail', () => {
  test('info_hub + message_only → triage (message_only is not full_service)', () => {
    assert.equal(
      deriveCallHandlingMode('info_hub', 'message_only'),
      'triage',
      'message_only is not preserved — only full_service gets preservation',
    )
  })

  test('appointment_booking + message_only → triage', () => {
    assert.equal(deriveCallHandlingMode('appointment_booking', 'message_only'), 'triage')
  })
})
