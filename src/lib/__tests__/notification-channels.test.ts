/**
 * notification-channels.test.ts — multichannel owner-alert tests
 *
 * Covers sendOwnerSmsAlert guard logic + testMode behavior. Does NOT call
 * Twilio (mocked at the module boundary). For real Twilio integration test,
 * see Gate A in the spec.
 *
 * Run: npx tsx --test src/lib/__tests__/notification-channels.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOwnerSmsBody,
  resolveSmsOwnerDestination,
  type CompletedClient,
  type Classification,
} from '../completed-notifications.js'

describe('sendOwnerSmsAlert: destination resolution', () => {
  test('uses alert_phone when set', () => {
    const dest = resolveSmsOwnerDestination({ alert_phone: '+13065551111', callback_phone: '+13065552222' })
    assert.equal(dest, '+13065551111')
  })

  test('falls back to callback_phone when alert_phone is null', () => {
    const dest = resolveSmsOwnerDestination({ alert_phone: null, callback_phone: '+13065552222' })
    assert.equal(dest, '+13065552222')
  })

  test('returns null when both are null', () => {
    const dest = resolveSmsOwnerDestination({ alert_phone: null, callback_phone: null })
    assert.equal(dest, null)
  })

  test('treats empty alert_phone as falsy → falls back', () => {
    const dest = resolveSmsOwnerDestination({ alert_phone: '', callback_phone: '+13065552222' })
    assert.equal(dest, '+13065552222')
  })
})

describe('sendOwnerSmsAlert: body builder', () => {
  function makeClassification(overrides: Partial<Classification> = {}): Classification {
    return {
      status: 'HOT',
      summary: 'Caller has a burst pipe and needs help immediately.',
      serviceType: 'emergency',
      confidence: 90,
      sentiment: 'frustrated',
      key_topics: ['burst pipe'],
      next_steps: 'Call Maya immediately.',
      quality_score: 88,
      caller_data: { caller_name: 'Maya', service_requested: 'Burst pipe' },
      ...overrides,
    }
  }

  test('formats HOT lead with emoji + caller name + phone + summary + tail', () => {
    const body = buildOwnerSmsBody({
      classification: makeClassification(),
      callerPhone: '+13065550123',
      businessName: 'Prairie Plumbing',
      testMode: false,
    })
    assert.match(body, /🔥/, 'expected HOT emoji 🔥')
    assert.match(body, /Maya/)
    assert.match(body, /306.*555.*0123/)
    assert.match(body, /burst pipe/i, 'summary or reason should reference the issue')
    assert.match(body, /Full details in your email/, 'expected tail directing owner to email')
  })

  test('prepends TEST — prefix when testMode is true', () => {
    const body = buildOwnerSmsBody({
      classification: makeClassification(),
      callerPhone: '+13065550123',
      businessName: 'Prairie Plumbing',
      testMode: true,
    })
    assert.ok(body.startsWith('TEST — '), `expected leading "TEST — " marker, got: ${body.slice(0, 50)}`)
  })

  test('stays under 1600 chars (Twilio multi-segment cap)', () => {
    const body = buildOwnerSmsBody({
      classification: makeClassification({
        summary: 'X'.repeat(2000),
        next_steps: 'Y'.repeat(500),
      }),
      callerPhone: '+13065550123',
      businessName: 'Prairie Plumbing',
      testMode: false,
    })
    assert.ok(body.length <= 1600, `body is ${body.length} chars, exceeds 1600`)
  })

  test('JUNK status still produces a body — owner sees the call happened', () => {
    const body = buildOwnerSmsBody({
      classification: makeClassification({ status: 'JUNK', summary: '' }),
      callerPhone: '+13065550123',
      businessName: 'Prairie Plumbing',
      testMode: false,
      durationSeconds: 8,
    })
    assert.notEqual(body, '', 'JUNK should still notify the owner')
    assert.match(body, /306.*555.*0123/, 'phone present so owner can call back')
    assert.match(body, /hung up|didn't|no details/i, 'honest fallback when caller gave nothing')
  })
})
