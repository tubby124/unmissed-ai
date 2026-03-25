/**
 * Tests for buildTrialWelcomeViewModel
 *
 * Key truth assertions:
 * - hasWebsite: must be 'complete' scrapeStatus (approved in DB), NOT just !!website_url
 * - daysLeft: computed from trial expiry, capped at 0
 * - isTrialExpired: had trial, expired, not converted
 * - provisioningState: driven by hasAgent + setup_complete
 */

import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { buildClientAgentConfig } from '../build-client-agent-config'
import { buildTrialWelcomeViewModel } from '../build-trial-welcome-view-model'
import type { ClientsRow } from '../build-client-agent-config'

// ── Base fixture ──────────────────────────────────────────────────────────────

function base(): ClientsRow {
  return {
    id: 'test-id',
    slug: 'test-co',
    business_name: 'Test Co',
    agent_name: 'Aria',
    niche: 'plumbing',
    subscription_status: 'trialing',
    trial_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    setup_complete: false,
    website_url: null,
    website_scrape_status: null,
    business_hours_weekday: null,
    extra_qa: [],
    forwarding_number: null,
  }
}

function buildVm(row: ClientsRow, hasAgent: boolean, now?: Date) {
  const config = buildClientAgentConfig(row, now ?? new Date())
  return buildTrialWelcomeViewModel(config, hasAgent, now ?? new Date())
}

// ── hasWebsite truth ──────────────────────────────────────────────────────────

describe('hasWebsite — scrapeStatus must be complete (approved in DB)', () => {
  test('no url, no scrape_status → false', () => {
    const vm = buildVm({ ...base(), website_url: null, website_scrape_status: null }, true)
    assert.equal(vm.hasWebsite, false)
  })

  test('url set, no scrape_status → false (URL ≠ corpus)', () => {
    const vm = buildVm({ ...base(), website_url: 'https://example.com', website_scrape_status: null }, true)
    assert.equal(vm.hasWebsite, false)
  })

  test('url set, scrape_status=scraping → false (in progress, not approved)', () => {
    const vm = buildVm({ ...base(), website_url: 'https://example.com', website_scrape_status: 'scraping' }, true)
    assert.equal(vm.hasWebsite, false)
  })

  test('url set, scrape_status=extracted → false (preview only, not approved)', () => {
    const vm = buildVm({ ...base(), website_url: 'https://example.com', website_scrape_status: 'extracted' }, true)
    assert.equal(vm.hasWebsite, false)
  })

  test('url set, scrape_status=failed → false', () => {
    const vm = buildVm({ ...base(), website_url: 'https://example.com', website_scrape_status: 'failed' }, true)
    assert.equal(vm.hasWebsite, false)
  })

  test('url set, scrape_status=approved → true (corpus is live)', () => {
    const vm = buildVm({ ...base(), website_url: 'https://example.com', website_scrape_status: 'approved' }, true)
    assert.equal(vm.hasWebsite, true)
  })

  test('legacy scrape_status=complete → true (treated as approved)', () => {
    const vm = buildVm({ ...base(), website_url: 'https://example.com', website_scrape_status: 'complete' }, true)
    assert.equal(vm.hasWebsite, true)
  })
})

// ── daysLeft ──────────────────────────────────────────────────────────────────

describe('daysLeft', () => {
  test('active trial 7 days from now → 7', () => {
    const now = new Date('2026-03-25T00:00:00Z')
    const row = { ...base(), trial_expires_at: '2026-04-01T00:00:00Z' }
    const vm = buildVm(row, true, now)
    assert.equal(vm.daysLeft, 7)
  })

  test('trial expires in 12h → 1 (ceil)', () => {
    const now = new Date('2026-03-25T00:00:00Z')
    const row = { ...base(), trial_expires_at: '2026-03-25T12:00:00Z' }
    const vm = buildVm(row, true, now)
    assert.equal(vm.daysLeft, 1)
  })

  test('trial already expired → null (isTrialActive=false)', () => {
    const now = new Date('2026-03-25T00:00:00Z')
    const row = { ...base(), trial_expires_at: '2026-03-20T00:00:00Z' }
    const vm = buildVm(row, true, now)
    assert.equal(vm.daysLeft, null)
  })

  test('no trial_expires_at → null', () => {
    const row = { ...base(), trial_expires_at: null }
    const vm = buildVm(row, true)
    assert.equal(vm.daysLeft, null)
  })

  test('converted user (active subscription) → null', () => {
    const row = { ...base(), subscription_status: 'active' }
    const vm = buildVm(row, true)
    assert.equal(vm.daysLeft, null)
  })
})

// ── isTrialExpired ────────────────────────────────────────────────────────────

describe('isTrialExpired', () => {
  test('expired + not converted → true', () => {
    const now = new Date('2026-03-25T00:00:00Z')
    const row = { ...base(), trial_expires_at: '2026-03-20T00:00:00Z', subscription_status: 'trialing' }
    const vm = buildVm(row, true, now)
    assert.equal(vm.isTrialExpired, true)
  })

  test('still active → false', () => {
    const now = new Date('2026-03-25T00:00:00Z')
    const row = { ...base(), trial_expires_at: '2026-04-01T00:00:00Z', subscription_status: 'trialing' }
    const vm = buildVm(row, true, now)
    assert.equal(vm.isTrialExpired, false)
  })

  test('expired but converted → false', () => {
    const now = new Date('2026-03-25T00:00:00Z')
    const row = { ...base(), trial_expires_at: '2026-03-20T00:00:00Z', subscription_status: 'active' }
    const vm = buildVm(row, true, now)
    assert.equal(vm.isTrialExpired, false)
  })

  test('no trial_expires_at → false', () => {
    const row = { ...base(), trial_expires_at: null }
    const vm = buildVm(row, true)
    assert.equal(vm.isTrialExpired, false)
  })
})

// ── provisioningState ─────────────────────────────────────────────────────────

describe('provisioningState', () => {
  test('no agent → incomplete', () => {
    const vm = buildVm(base(), false)
    assert.equal(vm.provisioningState, 'incomplete')
  })

  test('agent exists, setup_complete=false → pending', () => {
    const row = { ...base(), setup_complete: false }
    const vm = buildVm(row, true)
    assert.equal(vm.provisioningState, 'pending')
  })

  test('agent exists, setup_complete=true → ready', () => {
    const row = { ...base(), setup_complete: true }
    const vm = buildVm(row, true)
    assert.equal(vm.provisioningState, 'ready')
  })
})

// ── isFirstVisit ──────────────────────────────────────────────────────────────

describe('isFirstVisit', () => {
  test('setup_complete=false → isFirstVisit=true', () => {
    const vm = buildVm({ ...base(), setup_complete: false }, true)
    assert.equal(vm.isFirstVisit, true)
  })

  test('setup_complete=true → isFirstVisit=false', () => {
    const vm = buildVm({ ...base(), setup_complete: true }, true)
    assert.equal(vm.isFirstVisit, false)
  })
})

// ── hasHours / hasFaqs / hasForwardingNumber ──────────────────────────────────

describe('knowledge presence flags', () => {
  test('hasHours=false when no weekday hours', () => {
    const vm = buildVm({ ...base(), business_hours_weekday: null }, true)
    assert.equal(vm.hasHours, false)
  })

  test('hasHours=true when weekday hours set', () => {
    const vm = buildVm({ ...base(), business_hours_weekday: '9am-5pm' }, true)
    assert.equal(vm.hasHours, true)
  })

  test('hasFaqs=false when no extra_qa', () => {
    const vm = buildVm({ ...base(), extra_qa: [] }, true)
    assert.equal(vm.hasFaqs, false)
  })

  test('hasFaqs=true when extra_qa has entries', () => {
    const vm = buildVm({ ...base(), extra_qa: [{ q: 'Do you do repairs?', a: 'Yes' }] }, true)
    assert.equal(vm.hasFaqs, true)
  })

  test('hasForwardingNumber=false when no forwarding_number', () => {
    const vm = buildVm({ ...base(), forwarding_number: null }, true)
    assert.equal(vm.hasForwardingNumber, false)
  })

  test('hasForwardingNumber=true when forwarding_number set', () => {
    const vm = buildVm({ ...base(), forwarding_number: '+14035551234' }, true)
    assert.equal(vm.hasForwardingNumber, true)
  })
})
