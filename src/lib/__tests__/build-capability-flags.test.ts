/**
 * build-capability-flags.test.ts
 *
 * Tests for buildCapabilityFlags() — the pure function that assembles
 * runtime-truthful capability flags for the dashboard home route.
 *
 * Key concern: UI must NOT show a capability as active when it can't work at runtime.
 * Most critical: hasSms requires a Twilio number, not just sms_enabled=true.
 *
 * Run: npx tsx --test src/lib/__tests__/build-capability-flags.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { buildCapabilityFlags } from '../capability-flags.js'

function base() {
  return {
    knowledge_backend: null,
    business_facts: null,
    extra_qa: null,
    business_hours_weekday: null,
    booking_enabled: false,
    calendar_auth_status: null,
    sms_enabled: false,
    twilio_number: null,
    forwarding_number: null,
    website_url: null,
    website_scrape_status: null,
    // PRO plan — all entitlements enabled so tests focus on field-level logic, not plan gates
    selected_plan: 'pro',
    subscription_status: 'active',
  }
}

// ── hasSms — requires sms_enabled AND twilio_number ───────────────────────
// Trial users get sms_enabled=true during activation but NO twilio_number.
// Without this guard the card shows a green checkmark for a feature that can't work.

describe('hasSms — requires sms_enabled AND twilio_number', () => {
  test('trial user: sms_enabled=true, no twilio_number → false', () => {
    const f = buildCapabilityFlags({ ...base(), sms_enabled: true, twilio_number: null })
    assert.equal(f.hasSms, false)
  })

  test('paid user: sms_enabled=true + twilio_number set → true', () => {
    const f = buildCapabilityFlags({ ...base(), sms_enabled: true, twilio_number: '+15551234567' })
    assert.equal(f.hasSms, true)
  })

  test('sms explicitly disabled with twilio_number → false', () => {
    const f = buildCapabilityFlags({ ...base(), sms_enabled: false, twilio_number: '+15551234567' })
    assert.equal(f.hasSms, false)
  })

  test('both null → false', () => {
    assert.equal(buildCapabilityFlags(base()).hasSms, false)
  })
})

// ── hasBooking — requires booking_enabled AND calendar connected ───────────

describe('hasBooking — calendar_auth_status must be "connected"', () => {
  test('booking_enabled=true, no calendar (null) → false', () => {
    const f = buildCapabilityFlags({ ...base(), booking_enabled: true, calendar_auth_status: null })
    assert.equal(f.hasBooking, false)
  })

  test('booking_enabled=true, calendar_auth_status="pending" → false', () => {
    const f = buildCapabilityFlags({ ...base(), booking_enabled: true, calendar_auth_status: 'pending' })
    assert.equal(f.hasBooking, false)
  })

  test('booking_enabled=true, calendar_auth_status="disconnected" → false', () => {
    const f = buildCapabilityFlags({ ...base(), booking_enabled: true, calendar_auth_status: 'disconnected' })
    assert.equal(f.hasBooking, false)
  })

  test('booking_enabled=true, calendar_auth_status="connected" → true', () => {
    const f = buildCapabilityFlags({ ...base(), booking_enabled: true, calendar_auth_status: 'connected' })
    assert.equal(f.hasBooking, true)
  })

  test('booking_enabled=false, calendar connected → false', () => {
    const f = buildCapabilityFlags({ ...base(), booking_enabled: false, calendar_auth_status: 'connected' })
    assert.equal(f.hasBooking, false)
  })
})

// ── hasTransfer — forwarding_number set ───────────────────────────────────

describe('hasTransfer — forwarding_number is source of truth', () => {
  test('no forwarding_number → false', () => {
    assert.equal(buildCapabilityFlags(base()).hasTransfer, false)
  })

  test('forwarding_number set → true', () => {
    const f = buildCapabilityFlags({ ...base(), forwarding_number: '+15559876543' })
    assert.equal(f.hasTransfer, true)
  })
})

// ── hasKnowledge — pgvector backend ───────────────────────────────────────

describe('hasKnowledge — pgvector backend required', () => {
  test('knowledge_backend=null → false', () => {
    assert.equal(buildCapabilityFlags(base()).hasKnowledge, false)
  })

  test('knowledge_backend="pgvector" → true', () => {
    const f = buildCapabilityFlags({ ...base(), knowledge_backend: 'pgvector' })
    assert.equal(f.hasKnowledge, true)
  })

  test('knowledge_backend="other" (not pgvector) → false', () => {
    const f = buildCapabilityFlags({ ...base(), knowledge_backend: 'other' })
    assert.equal(f.hasKnowledge, false)
  })
})

// ── hasFaqs — non-empty extra_qa array ───────────────────────────────────

describe('hasFaqs — extra_qa must be non-empty array', () => {
  test('null → false', () => {
    assert.equal(buildCapabilityFlags(base()).hasFaqs, false)
  })

  test('empty array → false', () => {
    const f = buildCapabilityFlags({ ...base(), extra_qa: [] })
    assert.equal(f.hasFaqs, false)
  })

  test('one FAQ entry → true', () => {
    const f = buildCapabilityFlags({ ...base(), extra_qa: [{ q: 'Hours?', a: '9-5' }] })
    assert.equal(f.hasFaqs, true)
  })
})


// ── hasWebsite — requires website_scrape_status === 'approved' ───────────────
// URL set ≠ corpus ready. 'extracted' = preview only, not approved into knowledge base.

describe('hasWebsite — website_scrape_status must be approved', () => {
  test('url set but no scrape_status (null) → false', () => {
    const f = buildCapabilityFlags({ ...base(), website_url: 'https://example.com', website_scrape_status: null })
    assert.equal(f.hasWebsite, false)
  })

  test('url set, scrape_status=scraping → false', () => {
    const f = buildCapabilityFlags({ ...base(), website_url: 'https://example.com', website_scrape_status: 'scraping' })
    assert.equal(f.hasWebsite, false)
  })

  test('url set, scrape_status=extracted (preview only) → false', () => {
    const f = buildCapabilityFlags({ ...base(), website_url: 'https://example.com', website_scrape_status: 'extracted' })
    assert.equal(f.hasWebsite, false)
  })

  test('url set, scrape_status=failed → false', () => {
    const f = buildCapabilityFlags({ ...base(), website_url: 'https://example.com', website_scrape_status: 'failed' })
    assert.equal(f.hasWebsite, false)
  })

  test('url set, scrape_status=approved → true', () => {
    const f = buildCapabilityFlags({ ...base(), website_url: 'https://example.com', website_scrape_status: 'approved' })
    assert.equal(f.hasWebsite, true)
  })

  test('no url, scrape_status=approved (corrupted state) → true (status is authoritative)', () => {
    const f = buildCapabilityFlags({ ...base(), website_url: null, website_scrape_status: 'approved' })
    assert.equal(f.hasWebsite, true)
  })
})

// ── plan entitlement gates ────────────────────────────────────────────────
// buildCapabilityFlags must apply the same plan gates as buildAgentTools().
// A UI badge claiming "Active" when the agent tool won't fire is a fake-control bug.

describe('plan gates — SMS requires plan.smsEnabled', () => {
  test('LITE plan + sms_enabled + twilio_number → true (LITE includes SMS)', () => {
    const f = buildCapabilityFlags({ ...base(), selected_plan: 'lite', sms_enabled: true, twilio_number: '+15551234567' })
    assert.equal(f.hasSms, true)
  })

  test('CORE plan + sms_enabled + twilio_number → true', () => {
    const f = buildCapabilityFlags({ ...base(), selected_plan: 'core', sms_enabled: true, twilio_number: '+15551234567' })
    assert.equal(f.hasSms, true)
  })

  test('trialing + sms_enabled + twilio_number → true', () => {
    const f = buildCapabilityFlags({ ...base(), subscription_status: 'trialing', selected_plan: null, sms_enabled: true, twilio_number: '+15551234567' })
    assert.equal(f.hasSms, true)
  })
})

describe('plan gates — Booking requires plan.bookingEnabled', () => {
  test('CORE plan + booking_enabled + calendar connected → true (Core includes booking)', () => {
    const f = buildCapabilityFlags({ ...base(), selected_plan: 'core', booking_enabled: true, calendar_auth_status: 'connected' })
    assert.equal(f.hasBooking, true)
  })

  test('PRO plan + booking_enabled + calendar connected → true', () => {
    const f = buildCapabilityFlags({ ...base(), selected_plan: 'pro', booking_enabled: true, calendar_auth_status: 'connected' })
    assert.equal(f.hasBooking, true)
  })
})

describe('plan gates — Transfer requires plan.transferEnabled', () => {
  test('CORE plan + forwarding_number set → false (not on plan)', () => {
    const f = buildCapabilityFlags({ ...base(), selected_plan: 'core', forwarding_number: '+15559876543' })
    assert.equal(f.hasTransfer, false)
  })

  test('LITE plan + forwarding_number set → false (not on plan)', () => {
    const f = buildCapabilityFlags({ ...base(), selected_plan: 'lite', forwarding_number: '+15559876543' })
    assert.equal(f.hasTransfer, false)
  })

  test('PRO plan + forwarding_number set → true', () => {
    const f = buildCapabilityFlags({ ...base(), selected_plan: 'pro', forwarding_number: '+15559876543' })
    assert.equal(f.hasTransfer, true)
  })
})

describe('plan gates — Knowledge requires plan.knowledgeEnabled', () => {
  test('LITE plan + pgvector backend → false (not on plan)', () => {
    const f = buildCapabilityFlags({ ...base(), selected_plan: 'lite', knowledge_backend: 'pgvector' })
    assert.equal(f.hasKnowledge, false)
  })

  test('CORE plan + pgvector backend → true', () => {
    const f = buildCapabilityFlags({ ...base(), selected_plan: 'core', knowledge_backend: 'pgvector' })
    assert.equal(f.hasKnowledge, true)
  })
})

// ── all-false baseline ────────────────────────────────────────────────────

describe('all-false baseline — empty client', () => {
  test('base client has no capabilities enabled', () => {
    const f = buildCapabilityFlags(base())
    assert.equal(f.hasKnowledge, false)
    assert.equal(f.hasFacts, false)
    assert.equal(f.hasFaqs, false)
    assert.equal(f.hasHours, false)
    assert.equal(f.hasBooking, false)
    assert.equal(f.hasSms, false)
    assert.equal(f.hasTransfer, false)
    assert.equal(f.hasWebsite, false)
  })
})
