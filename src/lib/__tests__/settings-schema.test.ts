/**
 * settings-schema.test.ts — Unit tests for Zod schema, field registry, and sync derivation.
 *
 * Tests:
 * 1. Zod schema rejects invalid input, accepts valid input
 * 2. Field registry correctly classifies all fields by mutation class
 * 3. needsAgentSync derived from registry matches the pre-refactor manual boolean (snapshot)
 * 4. buildUpdates produces correct output for various field types
 * 5. Admin-only field filtering works correctly
 *
 * Run: npx tsx --test src/lib/__tests__/settings-schema.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  settingsBodySchema,
  FIELD_REGISTRY,
  SYNC_TRIGGER_FIELDS,
  buildUpdates,
  computeNeedsSync,
  validatePrompt,
  isSectionEditAllowed,
} from '../settings-schema.js'

// ── Zod schema validation ──────────────────────────────────────────────────────

describe('settingsBodySchema', () => {
  test('accepts valid minimal body (empty object)', () => {
    const result = settingsBodySchema.safeParse({})
    assert.ok(result.success, 'Empty body should be valid')
  })

  test('accepts valid body with string fields', () => {
    const result = settingsBodySchema.safeParse({
      agent_name: 'Mark',
      business_name: 'Windshield Hub',
      sms_enabled: true,
    })
    assert.ok(result.success)
    assert.equal(result.data.agent_name, 'Mark')
    assert.equal(result.data.sms_enabled, true)
  })

  test('rejects sms_enabled as string (must be boolean)', () => {
    const result = settingsBodySchema.safeParse({ sms_enabled: 'true' })
    assert.ok(!result.success, 'String "true" should fail boolean validation')
  })

  test('rejects booking_service_duration_minutes as 0 (must be positive)', () => {
    const result = settingsBodySchema.safeParse({ booking_service_duration_minutes: 0 })
    assert.ok(!result.success, 'Zero should fail positive number validation')
  })

  test('accepts booking_buffer_minutes as 0 (nonnegative)', () => {
    const result = settingsBodySchema.safeParse({ booking_buffer_minutes: 0 })
    assert.ok(result.success)
    assert.equal(result.data.booking_buffer_minutes, 0)
  })

  test('rejects invalid after_hours_behavior enum value', () => {
    const result = settingsBodySchema.safeParse({ after_hours_behavior: 'ignore' })
    assert.ok(!result.success, 'Invalid enum value should fail')
  })

  test('accepts valid after_hours_behavior enum', () => {
    const result = settingsBodySchema.safeParse({ after_hours_behavior: 'route_emergency' })
    assert.ok(result.success)
    assert.equal(result.data.after_hours_behavior, 'route_emergency')
  })

  test('accepts extra_qa as array of {q, a} objects', () => {
    const result = settingsBodySchema.safeParse({
      extra_qa: [{ q: 'What is your address?', a: '123 Main St' }],
    })
    assert.ok(result.success)
    assert.equal(result.data.extra_qa![0].q, 'What is your address?')
  })

  test('rejects extra_qa with missing fields', () => {
    const result = settingsBodySchema.safeParse({
      extra_qa: [{ q: 'What is your address?' }],
    })
    assert.ok(!result.success, 'Missing "a" field should fail')
  })

  test('accepts knowledge_backend as pgvector', () => {
    const result = settingsBodySchema.safeParse({ knowledge_backend: 'pgvector' })
    assert.ok(result.success)
    assert.equal(result.data.knowledge_backend, 'pgvector')
  })

  test('accepts knowledge_backend as null', () => {
    const result = settingsBodySchema.safeParse({ knowledge_backend: null })
    assert.ok(result.success)
    assert.equal(result.data.knowledge_backend, null)
  })

  test('rejects knowledge_backend as arbitrary string', () => {
    const result = settingsBodySchema.safeParse({ knowledge_backend: 'elasticsearch' })
    assert.ok(!result.success, 'Unknown backend should fail')
  })

  test('passes through unknown fields without error (passthrough mode)', () => {
    const result = settingsBodySchema.safeParse({ unknown_field: 'hello' })
    assert.ok(result.success, 'Unknown fields should pass through')
  })

  test('accepts injected_note as null', () => {
    const result = settingsBodySchema.safeParse({ injected_note: null })
    assert.ok(result.success)
    assert.equal(result.data.injected_note, null)
  })

  test('accepts injected_note as string', () => {
    const result = settingsBodySchema.safeParse({ injected_note: 'Office closed today' })
    assert.ok(result.success)
    assert.equal(result.data.injected_note, 'Office closed today')
  })
})

// ── Field registry ─────────────────────────────────────────────────────────────

describe('FIELD_REGISTRY', () => {
  test('every field has a valid mutationClass', () => {
    const validClasses = new Set([
      'DB_ONLY', 'DB_PLUS_PROMPT', 'DB_PLUS_TOOLS',
      'DB_PLUS_PROMPT_PLUS_TOOLS', 'DB_PLUS_KNOWLEDGE_PIPELINE',
      'PER_CALL_CONTEXT_ONLY',
    ])
    for (const [key, def] of Object.entries(FIELD_REGISTRY)) {
      assert.ok(validClasses.has(def.mutationClass), `${key} has invalid mutationClass: ${def.mutationClass}`)
    }
  })

  test('admin-only fields are correctly flagged', () => {
    const adminFields = Object.entries(FIELD_REGISTRY)
      .filter(([, def]) => def.adminOnly)
      .map(([key]) => key)
      .sort()

    const expected = [
      'calendar_beta_enabled',
      'knowledge_backend',
      'monthly_minute_limit',
      'telegram_bot_token',
      'telegram_chat_id',
      'twilio_number',
    ].sort()

    assert.deepEqual(adminFields, expected, 'Admin-only fields mismatch')
  })
})

// ── Sync trigger snapshot ──────────────────────────────────────────────────────

describe('SYNC_TRIGGER_FIELDS (snapshot)', () => {
  test('matches the pre-refactor manual needsAgentSync field list', () => {
    // This is the EXACT list of fields from the original manual boolean in settings/route.ts:
    //   typeof updates.system_prompt === 'string' ||
    //   'forwarding_number' in updates ||
    //   'transfer_conditions' in updates ||
    //   'booking_enabled' in updates ||
    //   'call_handling_mode' in updates ||
    //   'agent_voice_id' in updates ||
    //   'knowledge_backend' in updates ||
    //   'sms_enabled' in updates ||
    //   'twilio_number' in updates
    // Phase 4 addition: 'agent_mode' — deep-mode rebuild triggers Ultravox sync
    const expectedSyncFields = [
      'system_prompt',
      'forwarding_number',
      'transfer_conditions',
      'booking_enabled',
      'call_handling_mode',
      'agent_mode',
      'agent_voice_id',
      'knowledge_backend',
      'sms_enabled',
      'twilio_number',
    ].sort()

    const actual = [...SYNC_TRIGGER_FIELDS].sort()
    assert.deepEqual(actual, expectedSyncFields, 'Sync trigger fields derived from registry must match the original manual list')
  })
})

// ── computeNeedsSync ───────────────────────────────────────────────────────────

describe('computeNeedsSync', () => {
  test('returns true when system_prompt is a string in updates', () => {
    assert.ok(computeNeedsSync({ system_prompt: 'hello' }, false))
  })

  test('returns false when system_prompt is not in updates', () => {
    assert.ok(!computeNeedsSync({ agent_name: 'Bob' }, false))
  })

  test('returns true when forwarding_number is in updates', () => {
    assert.ok(computeNeedsSync({ forwarding_number: '+13065551234' }, false))
  })

  test('returns true when forwarding_number is null in updates', () => {
    // Removing forwarding number should still trigger sync (tool deregistration)
    assert.ok(computeNeedsSync({ forwarding_number: null }, false))
  })

  test('returns true when knowledgeReseeded is true', () => {
    assert.ok(computeNeedsSync({ agent_name: 'Bob' }, true))
  })

  test('returns false for DB_ONLY fields', () => {
    assert.ok(!computeNeedsSync({ voicemail_greeting_text: 'Hi' }, false))
    assert.ok(!computeNeedsSync({ ivr_enabled: true }, false))
    assert.ok(!computeNeedsSync({ telegram_style: 'compact' }, false))
  })

  test('returns false for PER_CALL_CONTEXT_ONLY fields', () => {
    assert.ok(!computeNeedsSync({ business_hours_weekday: '9-5' }, false))
    assert.ok(!computeNeedsSync({ injected_note: 'Closed today' }, false))
  })

  test('returns true for each sync-triggering field individually', () => {
    for (const field of SYNC_TRIGGER_FIELDS) {
      if (field === 'system_prompt') {
        assert.ok(computeNeedsSync({ [field]: 'test prompt' }, false), `${field} should trigger sync`)
      } else {
        assert.ok(computeNeedsSync({ [field]: 'test' }, false), `${field} should trigger sync`)
      }
    }
  })
})

// ── buildUpdates ───────────────────────────────────────────────────────────────

describe('buildUpdates', () => {
  test('trims and nullifies empty string fields', () => {
    const updates = buildUpdates({
      forwarding_number: '  ',
      owner_name: '  Bob  ',
    }, 'owner')

    assert.equal(updates.forwarding_number, null, 'Whitespace-only should become null')
    assert.equal(updates.owner_name, 'Bob', 'Should be trimmed')
  })

  test('copies boolean fields directly', () => {
    const updates = buildUpdates({ sms_enabled: true, booking_enabled: false }, 'owner')
    assert.equal(updates.sms_enabled, true)
    assert.equal(updates.booking_enabled, false)
  })

  test('filters admin-only fields when role is owner', () => {
    const updates = buildUpdates({
      telegram_bot_token: 'secret',
      twilio_number: '+15551234567',
      monthly_minute_limit: 500,
      knowledge_backend: 'pgvector',
      agent_name: 'Mark',
    }, 'owner')

    assert.ok(!('telegram_bot_token' in updates), 'Admin field should be filtered for owners')
    assert.ok(!('twilio_number' in updates), 'Admin field should be filtered for owners')
    assert.ok(!('monthly_minute_limit' in updates), 'Admin field should be filtered for owners')
    assert.ok(!('knowledge_backend' in updates), 'Admin field should be filtered for owners')
    assert.ok('agent_name' in updates, 'Non-admin field should pass')
  })

  test('includes admin-only fields when role is admin', () => {
    const updates = buildUpdates({
      twilio_number: '+15551234567',
      knowledge_backend: 'pgvector',
    }, 'admin')

    assert.equal(updates.twilio_number, '+15551234567')
    assert.equal(updates.knowledge_backend, 'pgvector')
  })

  test('handles injected_note as null correctly', () => {
    const updates = buildUpdates({ injected_note: null }, 'owner')
    assert.equal(updates.injected_note, null)
  })

  test('handles injected_note as whitespace-only string → null', () => {
    const updates = buildUpdates({ injected_note: '  ' }, 'owner')
    assert.equal(updates.injected_note, null)
  })

  test('system_prompt sets updated_at', () => {
    const updates = buildUpdates({ system_prompt: 'new prompt' }, 'owner')
    assert.equal(updates.system_prompt, 'new prompt')
    assert.ok('updated_at' in updates, 'Should set updated_at when system_prompt changes')
  })

  test('returns empty object when no recognized fields present', () => {
    const updates = buildUpdates({}, 'owner')
    assert.equal(Object.keys(updates).length, 0)
  })
})

// ── validatePrompt ─────────────────────────────────────────────────────────────

describe('validatePrompt', () => {
  test('rejects prompt over 12K chars', () => {
    const result = validatePrompt('x'.repeat(12001))
    assert.ok(!result.valid)
    assert.ok(result.error!.includes('12,000'))
  })

  test('warns about prompt over 8K chars', () => {
    const result = validatePrompt('x'.repeat(8001))
    assert.ok(result.valid)
    assert.ok(result.warnings.some(w => w.field === 'length'))
  })

  test('returns no warnings for short prompt', () => {
    const result = validatePrompt('Hello, I am your agent.')
    assert.ok(result.valid)
    assert.equal(result.warnings.length, 0)
  })

  test('warns about phone numbers in prompt', () => {
    const result = validatePrompt('Call us at 3065551234')
    assert.ok(result.valid)
    assert.ok(result.warnings.some(w => w.field === 'phone_number'))
  })

  test('warns about URLs in prompt', () => {
    const result = validatePrompt('Visit https://example.com for more')
    assert.ok(result.valid)
    assert.ok(result.warnings.some(w => w.field === 'url'))
  })
})

// ── isSectionEditAllowed ───────────────────────────────────────────────────────

describe('isSectionEditAllowed', () => {
  test('allows client-editable sections for owners', () => {
    assert.ok(isSectionEditAllowed('identity', 'owner'))
    assert.ok(isSectionEditAllowed('knowledge', 'owner'))
  })

  test('blocks admin-only sections for owners', () => {
    assert.ok(!isSectionEditAllowed('tone', 'owner'))
    assert.ok(!isSectionEditAllowed('flow', 'owner'))
    assert.ok(!isSectionEditAllowed('technical', 'owner'))
  })

  test('allows admin-only sections for admin', () => {
    assert.ok(isSectionEditAllowed('tone', 'admin'))
    assert.ok(isSectionEditAllowed('flow', 'admin'))
  })
})
