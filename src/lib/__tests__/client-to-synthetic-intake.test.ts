/**
 * client-to-synthetic-intake.test.ts — Phase 5a unit tests
 *
 * Verifies:
 *   1. deriveWeekendPolicy — all input cases
 *   2. clientToSyntheticIntake — field mapping from a stubbed clients row
 *   3. Provenance metadata is present and correct
 *   4. Throws on missing client
 *
 * Run: npx tsx --test src/lib/__tests__/client-to-synthetic-intake.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { deriveWeekendPolicy, clientToSyntheticIntake } from '../client-to-synthetic-intake.js'

// ── 1. deriveWeekendPolicy ────────────────────────────────────────────────────

describe('deriveWeekendPolicy', () => {
  test('null → closed weekends', () => {
    assert.equal(deriveWeekendPolicy(null), 'closed weekends')
  })

  test('undefined → closed weekends', () => {
    assert.equal(deriveWeekendPolicy(undefined), 'closed weekends')
  })

  test('empty string → closed weekends', () => {
    assert.equal(deriveWeekendPolicy(''), 'closed weekends')
  })

  test('whitespace only → closed weekends', () => {
    assert.equal(deriveWeekendPolicy('   '), 'closed weekends')
  })

  test('Saturday + Sunday → open weekends', () => {
    assert.equal(
      deriveWeekendPolicy('Saturday 9 AM–3 PM, Sunday 10 AM–2 PM'),
      'open weekends',
    )
  })

  test('Saturday only → open Saturdays only', () => {
    assert.equal(
      deriveWeekendPolicy('Saturday 9 AM–5 PM'),
      'open Saturdays only',
    )
  })

  test('Sunday only → open Sundays only', () => {
    assert.equal(
      deriveWeekendPolicy('Sunday 10 AM–4 PM'),
      'open Sundays only',
    )
  })

  test('content without day names → open weekends (safe default)', () => {
    assert.equal(
      deriveWeekendPolicy('By appointment on weekends'),
      'open weekends',
    )
  })

  test('case insensitive matching', () => {
    assert.equal(
      deriveWeekendPolicy('SATURDAY 9AM–5PM'),
      'open Saturdays only',
    )
  })
})

// ── 2. clientToSyntheticIntake — field mapping ────────────────────────────────

/** Build a minimal mock SupabaseClient that returns a fixed row. */
function mockSvc(row: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: row, error: row ? null : { message: 'not found' } }),
        }),
      }),
    }),
  }
}

const FULL_ROW = {
  id: 'abc-123',
  slug: 'hasan-sharif',
  business_name: 'Hasan Sharif Real Estate',
  niche: 'real_estate',
  agent_name: 'Aisha',
  system_prompt: 'x'.repeat(8500),
  timezone: 'America/Edmonton',
  business_hours_weekday: 'Monday–Friday 9 AM–5 PM',
  business_hours_weekend: 'Saturday 10 AM–3 PM',
  services_offered: 'Residential and commercial real estate in Edmonton',
  forwarding_number: '+17801234567',
  city: 'Edmonton',
  owner_name: 'Hasan Sharif',
  callback_phone: '+17809876543',
  call_handling_mode: 'triage',
  agent_mode: 'lead_capture',
}

describe('clientToSyntheticIntake — field mapping', () => {
  test('returns correct slug', async () => {
    const svc = mockSvc(FULL_ROW)
    const { slug } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(slug, 'hasan-sharif')
  })

  test('maps business_name correctly', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.business_name, 'Hasan Sharif Real Estate')
  })

  test('maps niche correctly', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.niche, 'real_estate')
  })

  test('maps agent_name correctly', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.agent_name, 'Aisha')
  })

  test('maps city correctly', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.city, 'Edmonton')
  })

  test('maps timezone correctly', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.timezone, 'America/Edmonton')
  })

  test('maps hours_weekday from business_hours_weekday', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.hours_weekday, 'Monday–Friday 9 AM–5 PM')
  })

  test('maps hours_weekend from business_hours_weekend', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.hours_weekend, 'Saturday 10 AM–3 PM')
  })

  test('derives weekend_policy from business_hours_weekend', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.weekend_policy, 'open Saturdays only')
  })

  test('maps services_offered correctly', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.services_offered, 'Residential and commercial real estate in Edmonton')
  })

  test('maps callback_phone correctly', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.callback_phone, '+17809876543')
  })

  test('maps owner_name correctly', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.owner_name, 'Hasan Sharif')
  })

  test('maps call_handling_mode correctly', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.call_handling_mode, 'triage')
  })

  test('maps agent_mode correctly', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.agent_mode, 'lead_capture')
  })

  test('maps forwarding_number → owner_phone', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload.owner_phone, '+17801234567')
  })
})

// ── 3. Provenance metadata ────────────────────────────────────────────────────

describe('Provenance metadata', () => {
  test('_synthetic_meta.synthetic is true', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload._synthetic_meta.synthetic, true)
  })

  test('_synthetic_meta.generated_by is "admin"', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload._synthetic_meta.generated_by, 'admin')
  })

  test('_synthetic_meta.source_client_id matches input', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload._synthetic_meta.source_client_id, 'abc-123')
  })

  test('_synthetic_meta.source_system_prompt_chars reflects prompt length', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    assert.equal(payload._synthetic_meta.source_system_prompt_chars, 8500)
  })

  test('_synthetic_meta.generated_at is a valid ISO date', async () => {
    const svc = mockSvc(FULL_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'abc-123')
    const parsed = new Date(payload._synthetic_meta.generated_at)
    assert.ok(!isNaN(parsed.getTime()), 'generated_at must be a valid ISO date')
  })
})

// ── 4. Null / missing field defaults ─────────────────────────────────────────

describe('Null / missing field defaults', () => {
  const SPARSE_ROW = {
    id: 'xyz-456',
    slug: 'sparse-client',
    business_name: 'Sparse Business',
    niche: null,
    agent_name: null,
    system_prompt: null,
    timezone: null,
    business_hours_weekday: null,
    business_hours_weekend: null,
    services_offered: null,
    forwarding_number: null,
    city: null,
    owner_name: null,
    callback_phone: null,
    call_handling_mode: null,
    agent_mode: null,
  }

  test('niche defaults to "other"', async () => {
    const svc = mockSvc(SPARSE_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'xyz-456')
    assert.equal(payload.niche, 'other')
  })

  test('timezone defaults to America/Edmonton', async () => {
    const svc = mockSvc(SPARSE_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'xyz-456')
    assert.equal(payload.timezone, 'America/Edmonton')
  })

  test('hours_weekday gets safe default', async () => {
    const svc = mockSvc(SPARSE_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'xyz-456')
    assert.ok(payload.hours_weekday.length > 0, 'hours_weekday must not be empty')
  })

  test('hours_weekend is null when not set', async () => {
    const svc = mockSvc(SPARSE_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'xyz-456')
    assert.equal(payload.hours_weekend, null)
  })

  test('weekend_policy is "closed weekends" when no weekend hours', async () => {
    const svc = mockSvc(SPARSE_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'xyz-456')
    assert.equal(payload.weekend_policy, 'closed weekends')
  })

  test('call_handling_mode defaults to triage', async () => {
    const svc = mockSvc(SPARSE_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'xyz-456')
    assert.equal(payload.call_handling_mode, 'triage')
  })

  test('agent_mode defaults to lead_capture', async () => {
    const svc = mockSvc(SPARSE_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'xyz-456')
    assert.equal(payload.agent_mode, 'lead_capture')
  })

  test('source_system_prompt_chars is 0 when system_prompt is null', async () => {
    const svc = mockSvc(SPARSE_ROW)
    const { payload } = await clientToSyntheticIntake(svc as never, 'xyz-456')
    assert.equal(payload._synthetic_meta.source_system_prompt_chars, 0)
  })
})

// ── 5. Throws on missing client ───────────────────────────────────────────────

describe('Error handling', () => {
  test('throws when client not found', async () => {
    const svc = mockSvc(null)
    await assert.rejects(
      () => clientToSyntheticIntake(svc as never, 'nonexistent-id'),
      /Client not found/,
    )
  })
})
