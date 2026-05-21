/**
 * data-hygiene.test.ts — unit tests for the 8 check functions.
 *
 * Catches regressions in: stale-note detection, content red-flag regex,
 * trial drift threshold, zombie-sub allow-list, plan-tier forbidden tool map,
 * stuck-call time math, voicemail age threshold, dupe number detection.
 *
 * Run: npx tsx --test src/lib/__tests__/data-hygiene.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkStaleNotes,
  checkInjectedNoteContent,
  checkTrialStatusDrift,
  checkZombieActiveSubs,
  checkPlanTierToolMismatch,
  checkStuckLiveCalls,
  checkUntranscribedVoicemails,
  checkDuplicateTwilioNumbers,
  worstSeverity,
  fingerprintResults,
  type ClientRow,
  type CallLogRow,
  type FlagsConfig,
} from '../data-hygiene.js'

const NOW = Date.UTC(2026, 4, 20) // 2026-05-20

const flags: FlagsConfig = {
  competitors: ['tim hortons', 'starbucks'],
  profanity: ['fuck', 'shit'],
  explicit: ['brazzers', 'porn'],
  url_regex: 'rx:https?://[\\w.\\-/?=&%#]+',
  allow_list_slugs: [],
}

function daysAgo(d: number): string {
  return new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString()
}
function daysAhead(d: number): string {
  return new Date(NOW + d * 24 * 60 * 60 * 1000).toISOString()
}

describe('A. checkStaleNotes', () => {
  test('PASS when no rows have notes', () => {
    const r = checkStaleNotes([{ slug: 'a' }], NOW)
    assert.equal(r.severity, 'PASS')
    assert.equal(r.findings.length, 0)
  })

  test('WARN when note has no expiry', () => {
    const r = checkStaleNotes([{ slug: 'a', injected_note: 'closed today' }], NOW)
    assert.equal(r.severity, 'WARN')
    assert.equal(r.findings[0].key, 'a')
  })

  test('WARN when expiry is in the past', () => {
    const r = checkStaleNotes([{ slug: 'a', injected_note: 'x', injected_note_expires_at: daysAgo(2) }], NOW)
    assert.equal(r.severity, 'WARN')
  })

  test('PASS when expiry is in the future', () => {
    const r = checkStaleNotes([{ slug: 'a', injected_note: 'x', injected_note_expires_at: daysAhead(1) }], NOW)
    assert.equal(r.severity, 'PASS')
  })
})

describe('B. checkInjectedNoteContent', () => {
  test('FAIL on competitor mention', () => {
    const r = checkInjectedNoteContent(
      [{ slug: 'plum-coffee', injected_note: 'Recommend Tim Hortons for breakfast' }],
      flags,
    )
    assert.equal(r.severity, 'FAIL')
    assert.match(r.findings[0].detail, /competitor:tim hortons/)
  })

  test('FAIL on explicit content', () => {
    const r = checkInjectedNoteContent(
      [{ slug: 'brazzers-office', injected_note: 'Hello from Brazzers HQ' }],
      flags,
    )
    assert.equal(r.severity, 'FAIL')
    assert.match(r.findings[0].detail, /explicit:brazzers/)
  })

  test('FAIL on URL in note', () => {
    const r = checkInjectedNoteContent(
      [{ slug: 'x', injected_note: 'see https://evil.com/abc for details' }],
      flags,
    )
    assert.equal(r.severity, 'FAIL')
    assert.match(r.findings[0].detail, /url:/)
  })

  test('FAIL on profanity', () => {
    const r = checkInjectedNoteContent([{ slug: 'x', injected_note: 'this is fucking broken' }], flags)
    assert.equal(r.severity, 'FAIL')
  })

  test('respects allow_list_slugs', () => {
    const r = checkInjectedNoteContent(
      [{ slug: 'demo', injected_note: 'mention Tim Hortons for demo screenshots' }],
      { ...flags, allow_list_slugs: ['demo'] },
    )
    assert.equal(r.severity, 'PASS')
  })

  test('PASS on benign note', () => {
    const r = checkInjectedNoteContent(
      [{ slug: 'x', injected_note: 'closed Monday for inventory' }],
      flags,
    )
    assert.equal(r.severity, 'PASS')
  })
})

describe('C. checkTrialStatusDrift', () => {
  test('FAIL when trialing past expiry', () => {
    const rows: ClientRow[] = [
      { slug: 'stuck', subscription_status: 'trialing', trial_expires_at: daysAgo(40) },
    ]
    const r = checkTrialStatusDrift(rows, NOW)
    assert.equal(r.severity, 'FAIL')
    assert.match(r.findings[0].detail, /expired 40d ago/)
  })

  test('PASS when trialing within window', () => {
    const rows: ClientRow[] = [
      { slug: 'fresh', subscription_status: 'trialing', trial_expires_at: daysAhead(2) },
    ]
    assert.equal(checkTrialStatusDrift(rows, NOW).severity, 'PASS')
  })

  test('PASS when not trialing', () => {
    const rows: ClientRow[] = [
      { slug: 'paid', subscription_status: 'active', trial_expires_at: daysAgo(40) },
    ]
    assert.equal(checkTrialStatusDrift(rows, NOW).severity, 'PASS')
  })
})

describe('D. checkZombieActiveSubs', () => {
  const allow = new Set(['hasan-sharif', 'exp-realty'])

  test('WARN on active sub with no stripe id and not allow-listed', () => {
    const r = checkZombieActiveSubs(
      [{ slug: 'mystery', subscription_status: 'active', stripe_subscription_id: null }],
      allow,
    )
    assert.equal(r.severity, 'WARN')
  })

  test('PASS when slug is in allow-list', () => {
    const r = checkZombieActiveSubs(
      [{ slug: 'hasan-sharif', subscription_status: 'active', stripe_subscription_id: null }],
      allow,
    )
    assert.equal(r.severity, 'PASS')
  })

  test('PASS when stripe_subscription_id is set', () => {
    const r = checkZombieActiveSubs(
      [{ slug: 'real-paid', subscription_status: 'active', stripe_subscription_id: 'sub_123' }],
      allow,
    )
    assert.equal(r.severity, 'PASS')
  })
})

describe('E. checkPlanTierToolMismatch', () => {
  test('FAIL when Lite plan has transferCall', () => {
    const r = checkPlanTierToolMismatch([
      { slug: 'lite-client', selected_plan: 'lite', tools_text: '[{"name":"transferCall"}]' },
    ])
    assert.equal(r.severity, 'FAIL')
    assert.match(r.findings[0].detail, /transferCall/)
  })

  test('FAIL when Lite plan has bookAppointment', () => {
    const r = checkPlanTierToolMismatch([
      { slug: 'lite-client', selected_plan: 'lite', tools_text: '[{"name":"bookAppointment"}]' },
    ])
    assert.equal(r.severity, 'FAIL')
    assert.match(r.findings[0].detail, /bookAppointment/)
  })

  test('FAIL when Lite plan has queryKnowledge', () => {
    const r = checkPlanTierToolMismatch([
      { slug: 'lite-client', selected_plan: 'lite', tools_text: '[{"name":"queryKnowledge"}]' },
    ])
    assert.equal(r.severity, 'FAIL')
  })

  test('FAIL when Lite plan has checkForCoaching', () => {
    const r = checkPlanTierToolMismatch([
      { slug: 'lite-client', selected_plan: 'lite', tools_text: '[{"name":"checkForCoaching"}]' },
    ])
    assert.equal(r.severity, 'FAIL')
  })

  test('PASS when Core has checkForCoaching (Core includes learning loop)', () => {
    // Regression guard for 2026-05-21 false-positive batch:
    // old hardcoded list flagged Core+checkForCoaching but plan-entitlements
    // gives Core learningLoopEnabled=true. The check must read live entitlements.
    const r = checkPlanTierToolMismatch([
      { slug: 'core-client', selected_plan: 'core', tools_text: '[{"name":"checkForCoaching"}]' },
    ])
    assert.equal(r.severity, 'PASS')
  })

  test('PASS when Core has bookAppointment + transferCall (both included)', () => {
    const r = checkPlanTierToolMismatch([
      { slug: 'core-client', selected_plan: 'core', tools_text: '[{"name":"bookAppointment"},{"name":"transferCall"}]' },
    ])
    assert.equal(r.severity, 'PASS')
  })

  test('PASS when Pro has transferCall (allowed)', () => {
    const r = checkPlanTierToolMismatch([
      { slug: 'pro-client', selected_plan: 'pro', tools_text: '[{"name":"transferCall"}]' },
    ])
    assert.equal(r.severity, 'PASS')
  })

  test('PASS when tools_text is empty', () => {
    const r = checkPlanTierToolMismatch([{ slug: 'x', selected_plan: 'lite', tools_text: null }])
    assert.equal(r.severity, 'PASS')
  })

  test('PASS when client is trialing (trial entitlements grant all caps)', () => {
    // Trial bypass: subscription_status=trialing means TRIAL entitlements apply,
    // not selected_plan. Trial clients see all features regardless of their
    // future plan choice.
    const r = checkPlanTierToolMismatch([
      {
        slug: 'trial-lite',
        selected_plan: 'lite',
        subscription_status: 'trialing',
        tools_text: '[{"name":"transferCall"},{"name":"bookAppointment"},{"name":"checkForCoaching"}]',
      },
    ])
    assert.equal(r.severity, 'PASS')
  })

  test('FAIL detects gated pageOwner on Lite (same gate as transferCall)', () => {
    const r = checkPlanTierToolMismatch([
      { slug: 'lite-client', selected_plan: 'lite', tools_text: '[{"temporaryTool":{"modelToolName":"pageOwner"}}]' },
    ])
    assert.equal(r.severity, 'FAIL')
    assert.match(r.findings[0].detail, /pageOwner/)
  })
})

describe('F. checkStuckLiveCalls', () => {
  test('WARN when live call > 2h old', () => {
    const rows: CallLogRow[] = [
      { id: 'c1', call_status: 'live', created_at: new Date(NOW - 3 * 60 * 60 * 1000).toISOString() },
    ]
    const r = checkStuckLiveCalls(rows, NOW)
    assert.equal(r.severity, 'WARN')
  })

  test('PASS when live call < 2h old', () => {
    const rows: CallLogRow[] = [
      { id: 'c1', call_status: 'live', created_at: new Date(NOW - 30 * 60 * 1000).toISOString() },
    ]
    assert.equal(checkStuckLiveCalls(rows, NOW).severity, 'PASS')
  })

  test('PASS when call_status is not live', () => {
    const rows: CallLogRow[] = [
      { id: 'c1', call_status: 'completed', created_at: new Date(NOW - 10 * 60 * 60 * 1000).toISOString() },
    ]
    assert.equal(checkStuckLiveCalls(rows, NOW).severity, 'PASS')
  })
})

describe('G. checkUntranscribedVoicemails', () => {
  test('WARN when VOICEMAIL > 24h with no summary', () => {
    const rows: CallLogRow[] = [
      { id: 'v1', call_status: 'VOICEMAIL', ai_summary: null, created_at: daysAgo(2) },
    ]
    assert.equal(checkUntranscribedVoicemails(rows, NOW).severity, 'WARN')
  })

  test('WARN when ai_summary contains PLACEHOLDER', () => {
    const rows: CallLogRow[] = [
      { id: 'v1', call_status: 'VOICEMAIL', ai_summary: '[PLACEHOLDER awaiting transcription]', created_at: daysAgo(2) },
    ]
    assert.equal(checkUntranscribedVoicemails(rows, NOW).severity, 'WARN')
  })

  test('PASS when transcribed', () => {
    const rows: CallLogRow[] = [
      { id: 'v1', call_status: 'VOICEMAIL', ai_summary: 'Caller asked for callback re leak.', created_at: daysAgo(2) },
    ]
    assert.equal(checkUntranscribedVoicemails(rows, NOW).severity, 'PASS')
  })
})

describe('H. checkDuplicateTwilioNumbers', () => {
  test('FAIL when two clients hold the same number', () => {
    const rows: ClientRow[] = [
      { slug: 'a', twilio_number: '+13065551234' },
      { slug: 'b', twilio_number: '+13065551234' },
    ]
    const r = checkDuplicateTwilioNumbers(rows)
    assert.equal(r.severity, 'FAIL')
    assert.match(r.findings[0].detail, /a, b/)
  })

  test('PASS when numbers are unique', () => {
    const rows: ClientRow[] = [
      { slug: 'a', twilio_number: '+13065551234' },
      { slug: 'b', twilio_number: '+13065559999' },
    ]
    assert.equal(checkDuplicateTwilioNumbers(rows).severity, 'PASS')
  })

  test('PASS when numbers are NULL', () => {
    const rows: ClientRow[] = [
      { slug: 'a', twilio_number: null },
      { slug: 'b', twilio_number: null },
    ]
    assert.equal(checkDuplicateTwilioNumbers(rows).severity, 'PASS')
  })
})

describe('summary helpers', () => {
  test('worstSeverity escalates correctly', () => {
    assert.equal(
      worstSeverity([
        { id: 'x', label: 'x', severity: 'PASS', findings: [] },
        { id: 'y', label: 'y', severity: 'WARN', findings: [] },
      ]),
      'WARN',
    )
    assert.equal(
      worstSeverity([
        { id: 'x', label: 'x', severity: 'WARN', findings: [] },
        { id: 'y', label: 'y', severity: 'FAIL', findings: [] },
      ]),
      'FAIL',
    )
    assert.equal(worstSeverity([{ id: 'x', label: 'x', severity: 'PASS', findings: [] }]), 'PASS')
  })

  test('fingerprintResults is stable + deduplicates ordering', () => {
    const a = [
      {
        id: 'A_stale_notes',
        label: 'x',
        severity: 'WARN' as const,
        findings: [{ key: 'b', detail: '' }, { key: 'a', detail: '' }],
      },
    ]
    const b = [
      {
        id: 'A_stale_notes',
        label: 'x',
        severity: 'WARN' as const,
        findings: [{ key: 'a', detail: '' }, { key: 'b', detail: '' }],
      },
    ]
    assert.equal(fingerprintResults(a), fingerprintResults(b))
  })
})
