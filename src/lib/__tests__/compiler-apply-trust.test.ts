/**
 * Unit tests for AI Compiler trust-tier and blocking behaviour.
 *
 * Imports the exported constants from the apply route so that if the
 * canonical sets change, these tests catch the regression immediately.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  BLOCKED_KINDS,
  HIGH_RISK_KINDS,
} from '../../app/api/dashboard/knowledge/compile/apply/route'

// Pure helper that replicates the route's trustTier mapping (one line in route)
function trustTierForKind(kind: string): 'medium' | 'high' {
  return HIGH_RISK_KINDS.has(kind) ? 'medium' : 'high'
}

// ── BLOCKED_KINDS ─────────────────────────────────────────────────────────────

describe('BLOCKED_KINDS — items are never written to the knowledge store', () => {
  test('call_behavior_instruction is blocked', () => {
    assert.ok(BLOCKED_KINDS.has('call_behavior_instruction'))
  })

  test('unsupported_or_ambiguous is blocked', () => {
    assert.ok(BLOCKED_KINDS.has('unsupported_or_ambiguous'))
  })

  test('conflict_flag is blocked', () => {
    assert.ok(BLOCKED_KINDS.has('conflict_flag'))
  })

  test('business_fact is NOT blocked', () => {
    assert.ok(!BLOCKED_KINDS.has('business_fact'))
  })

  test('faq_pair is NOT blocked', () => {
    assert.ok(!BLOCKED_KINDS.has('faq_pair'))
  })

  // High-risk kinds are approvable (not blocked) — they get medium trustTier instead
  test('pricing_or_offer is NOT blocked (approvable, just high-risk)', () => {
    assert.ok(!BLOCKED_KINDS.has('pricing_or_offer'))
  })

  test('hours_or_availability is NOT blocked (approvable, just high-risk)', () => {
    assert.ok(!BLOCKED_KINDS.has('hours_or_availability'))
  })

  test('location_or_service_area is NOT blocked (approvable, just high-risk)', () => {
    assert.ok(!BLOCKED_KINDS.has('location_or_service_area'))
  })

  test('operating_policy is NOT blocked (approvable, just high-risk)', () => {
    assert.ok(!BLOCKED_KINDS.has('operating_policy'))
  })
})

// ── trustTier by kind ─────────────────────────────────────────────────────────

describe('trustTier — high-risk kinds get medium, everything else gets high', () => {
  // High-risk → medium
  test('pricing_or_offer → medium', () => {
    assert.equal(trustTierForKind('pricing_or_offer'), 'medium')
  })

  test('hours_or_availability → medium', () => {
    assert.equal(trustTierForKind('hours_or_availability'), 'medium')
  })

  test('location_or_service_area → medium', () => {
    assert.equal(trustTierForKind('location_or_service_area'), 'medium')
  })

  test('operating_policy → medium', () => {
    assert.equal(trustTierForKind('operating_policy'), 'medium')
  })

  // Standard kinds → high
  test('business_fact → high', () => {
    assert.equal(trustTierForKind('business_fact'), 'high')
  })

  test('faq_pair → high (FAQs go to extra_qa, not chunks — tier is moot)', () => {
    assert.equal(trustTierForKind('faq_pair'), 'high')
  })

  // Unknown kind falls through to 'high' — safe default, not blocked
  test('unknown kind → high (safe default)', () => {
    assert.equal(trustTierForKind('some_future_kind'), 'high')
  })
})

// ── Route-level filter behaviour ──────────────────────────────────────────────

describe('factItems filter — blocked kinds are stripped before embed', () => {
  const rawItems = [
    { kind: 'business_fact', text: 'We serve Greater Vancouver.' },
    { kind: 'call_behavior_instruction', text: 'Always say hello.' },
    { kind: 'pricing_or_offer', text: 'Free estimates over $200.' },
    { kind: 'conflict_flag', text: 'Conflict: hours differ.' },
    { kind: 'unsupported_or_ambiguous', text: 'Some vague claim.' },
  ]

  // Replicate the route's filter exactly
  const factItems = rawItems.filter(i => i.text?.trim() && !BLOCKED_KINDS.has(i.kind))

  test('2 items survive the filter (business_fact + pricing_or_offer remain)', () => {
    assert.equal(factItems.length, 2)
  })

  test('call_behavior_instruction is stripped', () => {
    assert.ok(!factItems.some(i => i.kind === 'call_behavior_instruction'))
  })

  test('conflict_flag is stripped', () => {
    assert.ok(!factItems.some(i => i.kind === 'conflict_flag'))
  })

  test('unsupported_or_ambiguous is stripped', () => {
    assert.ok(!factItems.some(i => i.kind === 'unsupported_or_ambiguous'))
  })

  test('pricing_or_offer survives and gets trustTier=medium', () => {
    const pricing = factItems.find(i => i.kind === 'pricing_or_offer')
    assert.ok(pricing)
    assert.equal(trustTierForKind(pricing.kind), 'medium')
  })

  test('business_fact survives and gets trustTier=high', () => {
    const fact = factItems.find(i => i.kind === 'business_fact')
    assert.ok(fact)
    assert.equal(trustTierForKind(fact.kind), 'high')
  })
})
