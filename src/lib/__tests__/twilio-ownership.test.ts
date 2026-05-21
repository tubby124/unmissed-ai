/**
 * twilio-ownership.test.ts — unit tests for the pure ownership-diff logic.
 *
 * Run: npx tsx --test src/lib/__tests__/twilio-ownership.test.ts
 *
 * Mocks Twilio responses + DB rows. NO live API calls.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  diffOwnership,
  expectedConfigFor,
  isHealthyStatus,
  type OwnershipClientRow,
  type TwilioInventoryNumber,
  type ExpectedConfigOpts,
} from '../twilio-ownership.js'

const APP_URL = 'https://endvoicemail.ai'
const FALLBACK = 'https://fallback.endvoicemail.ai/voice'

const defaultOpts: ExpectedConfigOpts = {
  appUrl: APP_URL,
  voiceFallbackUrl: FALLBACK,
  statusCallback: null,
}

function healthyTwilio(slug: string, phone: string): TwilioInventoryNumber {
  return {
    sid: `PN${phone.slice(-10)}`,
    phoneNumber: phone,
    status: 'in-use',
    voiceUrl: `${APP_URL}/api/webhook/${slug}/inbound`,
    voiceFallbackUrl: FALLBACK,
    statusCallback: null,
    capabilities: { voice: true, sms: true, mms: true, fax: false },
  }
}

describe('expectedConfigFor', () => {
  test('builds correct voice URL with slug', () => {
    const c = expectedConfigFor('auto-glass-yyc', defaultOpts)
    assert.equal(c.voiceUrl, 'https://endvoicemail.ai/api/webhook/auto-glass-yyc/inbound')
    assert.equal(c.voiceFallbackUrl, FALLBACK)
  })

  test('strips trailing slash from appUrl', () => {
    const c = expectedConfigFor('x', { ...defaultOpts, appUrl: 'https://endvoicemail.ai/' })
    assert.equal(c.voiceUrl, 'https://endvoicemail.ai/api/webhook/x/inbound')
  })
})

describe('isHealthyStatus', () => {
  test('only in-use is healthy', () => {
    assert.equal(isHealthyStatus('in-use'), true)
    assert.equal(isHealthyStatus('suspended'), false)
    assert.equal(isHealthyStatus('pending'), false)
    assert.equal(isHealthyStatus('released'), false)
    assert.equal(isHealthyStatus(''), false)
  })
})

describe('diffOwnership — clean baseline', () => {
  test('zero findings when DB and Twilio agree', () => {
    const clients: OwnershipClientRow[] = [
      { slug: 'auto-glass-yyc', twilio_number: '+15551110001' },
      { slug: 'urban-vibe', twilio_number: '+15551110002', sms_enabled: true },
    ]
    const inventory: TwilioInventoryNumber[] = [
      healthyTwilio('auto-glass-yyc', '+15551110001'),
      healthyTwilio('urban-vibe', '+15551110002'),
    ]
    const findings = diffOwnership(clients, inventory, defaultOpts)
    assert.equal(findings.length, 0)
  })
})

describe('diffOwnership — twilio_number_orphan_in_db (P0)', () => {
  test('flags DB number missing from Twilio', () => {
    const clients: OwnershipClientRow[] = [
      { slug: 'lost-client', twilio_number: '+15559990000' },
    ]
    const findings = diffOwnership(clients, [], defaultOpts)
    assert.equal(findings.length, 1)
    assert.equal(findings[0].check_name, 'twilio_number_orphan_in_db')
    assert.equal(findings[0].severity, 'P0')
    assert.equal(findings[0].client_slug, 'lost-client')
    assert.match(findings[0].summary, /no record of \+15559990000/)
  })

  test('orphan in DB short-circuits other checks for that row', () => {
    // If the number is gone, we should NOT also emit voice-url drift for it.
    const clients: OwnershipClientRow[] = [
      { slug: 'a', twilio_number: '+15550000001' },
    ]
    const findings = diffOwnership(clients, [], defaultOpts)
    const checks = findings.map(f => f.check_name)
    assert.deepEqual(checks, ['twilio_number_orphan_in_db'])
  })
})

describe('diffOwnership — twilio_number_suspended (P0)', () => {
  test('flags non-in-use status', () => {
    const clients: OwnershipClientRow[] = [
      { slug: 'a', twilio_number: '+15550000010' },
    ]
    const tw = healthyTwilio('a', '+15550000010')
    tw.status = 'suspended'
    const findings = diffOwnership(clients, [tw], defaultOpts)
    const suspended = findings.find(f => f.check_name === 'twilio_number_suspended')
    assert.ok(suspended, 'expected twilio_number_suspended finding')
    assert.equal(suspended!.severity, 'P0')
    assert.equal(suspended!.client_slug, 'a')
    assert.match(suspended!.summary, /status=suspended/)
  })
})

describe('diffOwnership — twilio_voice_url_mismatch (P0)', () => {
  test('flags webhook drift', () => {
    const clients: OwnershipClientRow[] = [
      { slug: 'drift-client', twilio_number: '+15550000020' },
    ]
    const tw = healthyTwilio('drift-client', '+15550000020')
    tw.voiceUrl = 'https://old.example.com/voice'
    const findings = diffOwnership(clients, [tw], defaultOpts)
    const drift = findings.find(f => f.check_name === 'twilio_voice_url_mismatch')
    assert.ok(drift)
    assert.equal(drift!.severity, 'P0')
    assert.equal((drift!.details as { actual: string }).actual, 'https://old.example.com/voice')
  })

  test('trailing slash on Twilio voiceUrl does NOT trigger drift', () => {
    const clients: OwnershipClientRow[] = [
      { slug: 'a', twilio_number: '+15550000030' },
    ]
    const tw = healthyTwilio('a', '+15550000030')
    tw.voiceUrl = `${APP_URL}/api/webhook/a/inbound/`
    const findings = diffOwnership(clients, [tw], defaultOpts)
    assert.equal(findings.filter(f => f.check_name === 'twilio_voice_url_mismatch').length, 0)
  })

  test('empty voiceUrl in Twilio is flagged', () => {
    const clients: OwnershipClientRow[] = [
      { slug: 'a', twilio_number: '+15550000031' },
    ]
    const tw = healthyTwilio('a', '+15550000031')
    tw.voiceUrl = null
    const findings = diffOwnership(clients, [tw], defaultOpts)
    const drift = findings.find(f => f.check_name === 'twilio_voice_url_mismatch')
    assert.ok(drift)
    assert.equal((drift!.details as { actual: string }).actual, '(empty)')
  })
})

describe('diffOwnership — twilio_voice_fallback_url_mismatch (P1)', () => {
  test('flags fallback drift', () => {
    const clients: OwnershipClientRow[] = [
      { slug: 'a', twilio_number: '+15550000040' },
    ]
    const tw = healthyTwilio('a', '+15550000040')
    tw.voiceFallbackUrl = 'https://wrong-fallback.example.com'
    const findings = diffOwnership(clients, [tw], defaultOpts)
    const drift = findings.find(f => f.check_name === 'twilio_voice_fallback_url_mismatch')
    assert.ok(drift)
    assert.equal(drift!.severity, 'P1')
  })

  test('null expected fallback skips the check', () => {
    const clients: OwnershipClientRow[] = [
      { slug: 'a', twilio_number: '+15550000041' },
    ]
    const tw = healthyTwilio('a', '+15550000041')
    tw.voiceFallbackUrl = 'https://anything.example.com'
    const findings = diffOwnership(clients, [tw], { ...defaultOpts, voiceFallbackUrl: null })
    assert.equal(findings.filter(f => f.check_name === 'twilio_voice_fallback_url_mismatch').length, 0)
  })
})

describe('diffOwnership — twilio_status_callback_mismatch (P1)', () => {
  test('flags status-callback drift when expected URL set', () => {
    const expectedCb = 'https://endvoicemail.ai/api/webhook/call-status'
    const clients: OwnershipClientRow[] = [
      { slug: 'a', twilio_number: '+15550000050' },
    ]
    const tw = healthyTwilio('a', '+15550000050')
    tw.statusCallback = 'https://drift.example.com/cb'
    const findings = diffOwnership(clients, [tw], { ...defaultOpts, statusCallback: expectedCb })
    const drift = findings.find(f => f.check_name === 'twilio_status_callback_mismatch')
    assert.ok(drift)
    assert.equal(drift!.severity, 'P1')
  })

  test('null expected callback skips the check', () => {
    const clients: OwnershipClientRow[] = [
      { slug: 'a', twilio_number: '+15550000051' },
    ]
    const tw = healthyTwilio('a', '+15550000051')
    tw.statusCallback = 'anything'
    const findings = diffOwnership(clients, [tw], defaultOpts)
    assert.equal(findings.filter(f => f.check_name === 'twilio_status_callback_mismatch').length, 0)
  })
})

describe('diffOwnership — twilio_number_orphan_in_account (P1)', () => {
  test('flags Twilio number missing from DB', () => {
    const clients: OwnershipClientRow[] = []
    const inventory = [healthyTwilio('unused', '+15550009999')]
    const findings = diffOwnership(clients, inventory, defaultOpts)
    assert.equal(findings.length, 1)
    assert.equal(findings[0].check_name, 'twilio_number_orphan_in_account')
    assert.equal(findings[0].severity, 'P1')
    assert.equal(findings[0].client_slug, null, 'account-level finding has null slug')
  })

  test('no orphan when every Twilio number is claimed', () => {
    const clients: OwnershipClientRow[] = [{ slug: 'a', twilio_number: '+15550001111' }]
    const inventory = [healthyTwilio('a', '+15550001111')]
    const findings = diffOwnership(clients, inventory, defaultOpts)
    assert.equal(findings.filter(f => f.check_name === 'twilio_number_orphan_in_account').length, 0)
  })
})

describe('diffOwnership — twilio_number_capabilities_missing (P1)', () => {
  test('flags missing voice', () => {
    const clients: OwnershipClientRow[] = [{ slug: 'a', twilio_number: '+15550002001' }]
    const tw = healthyTwilio('a', '+15550002001')
    tw.capabilities = { voice: false, sms: true, mms: false, fax: false }
    const findings = diffOwnership(clients, [tw], defaultOpts)
    const cap = findings.find(f => f.check_name === 'twilio_number_capabilities_missing')
    assert.ok(cap)
    assert.deepEqual((cap!.details as { missing: string[] }).missing, ['voice'])
  })

  test('flags missing sms ONLY when client.sms_enabled = true', () => {
    const clients: OwnershipClientRow[] = [
      { slug: 'with-sms', twilio_number: '+15550002010', sms_enabled: true },
      { slug: 'no-sms', twilio_number: '+15550002011', sms_enabled: false },
    ]
    const twWith = healthyTwilio('with-sms', '+15550002010')
    twWith.capabilities = { voice: true, sms: false, mms: false, fax: false }
    const twNo = healthyTwilio('no-sms', '+15550002011')
    twNo.capabilities = { voice: true, sms: false, mms: false, fax: false }
    const findings = diffOwnership(clients, [twWith, twNo], defaultOpts)
    const capFindings = findings.filter(f => f.check_name === 'twilio_number_capabilities_missing')
    assert.equal(capFindings.length, 1, 'only sms_enabled=true client should flag')
    assert.equal(capFindings[0].client_slug, 'with-sms')
  })

  test('does NOT flag when Twilio number has MORE capabilities than client uses', () => {
    const clients: OwnershipClientRow[] = [
      { slug: 'a', twilio_number: '+15550002020', sms_enabled: false },
    ]
    // Twilio number supports SMS, client doesn't need it — that's fine.
    const findings = diffOwnership(clients, [healthyTwilio('a', '+15550002020')], defaultOpts)
    assert.equal(findings.filter(f => f.check_name === 'twilio_number_capabilities_missing').length, 0)
  })
})

describe('diffOwnership — multiple findings on same row', () => {
  test('suspended + voice-url drift surfaces both', () => {
    const clients: OwnershipClientRow[] = [{ slug: 'busted', twilio_number: '+15550003001' }]
    const tw = healthyTwilio('busted', '+15550003001')
    tw.status = 'suspended'
    tw.voiceUrl = 'https://stale.example.com/voice'
    const findings = diffOwnership(clients, [tw], defaultOpts)
    const checks = findings.map(f => f.check_name).sort()
    assert.deepEqual(checks, ['twilio_number_suspended', 'twilio_voice_url_mismatch'])
    // Both are P0 — operator should see ONE alert with two lines, not one suppressed.
    assert.ok(findings.every(f => f.severity === 'P0'))
  })
})

describe('diffOwnership — fleet mix', () => {
  test('handles real-world mix: clean + orphan-in-db + orphan-in-account + drift', () => {
    const clients: OwnershipClientRow[] = [
      { slug: 'healthy', twilio_number: '+15550004001' },
      { slug: 'released', twilio_number: '+15550004002' }, // missing from Twilio
      { slug: 'drifted', twilio_number: '+15550004003' },
    ]
    const inventory: TwilioInventoryNumber[] = [
      healthyTwilio('healthy', '+15550004001'),
      // released number absent → orphan_in_db
      (() => {
        const tw = healthyTwilio('drifted', '+15550004003')
        tw.voiceUrl = 'https://wrong-host.example.com/inbound'
        return tw
      })(),
      // Twilio has an extra number nobody claims
      healthyTwilio('ghost', '+15550004999'),
    ]
    const findings = diffOwnership(clients, inventory, defaultOpts)
    const byCheck = findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.check_name] = (acc[f.check_name] ?? 0) + 1
      return acc
    }, {})
    assert.equal(byCheck.twilio_number_orphan_in_db, 1)
    assert.equal(byCheck.twilio_voice_url_mismatch, 1)
    assert.equal(byCheck.twilio_number_orphan_in_account, 1)
    // Ghost number's voiceUrl also drifts (points to /ghost/inbound but no DB row),
    // but we don't flag voice-url drift for unclaimed numbers — only orphan-in-account.
    assert.equal(byCheck.twilio_voice_url_mismatch, 1, 'voice-url drift only for claimed numbers')
  })
})
