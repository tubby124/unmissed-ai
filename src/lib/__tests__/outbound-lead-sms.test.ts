import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getOutboundLeadSmsTemplate } from '../sms-templates.js'

// Post-call SMS lanes for outbound lead-qualification calls
// (call-quality-overhaul design 2026-06-12: booked → confirm, vm/no-answer →
// list-landed pair, answered-not-booked → nothing).

describe('getOutboundLeadSmsTemplate', () => {
  const base = { businessName: "Hasan Sharif's office", agentName: 'Aisha' }

  it('booked → confirmation text fulfilling the "we will text to confirm" promise', () => {
    const body = getOutboundLeadSmsTemplate('booked', {
      ...base,
      callerName: 'Jacob',
      appointmentTime: 'tomorrow evening',
    })
    assert.ok(body)
    assert.match(body!, /Jacob/)
    assert.match(body!, /Aisha at Hasan Sharif's office/)
    assert.match(body!, /confirming/i)
    assert.match(body!, /tomorrow evening/)
    assert.match(body!, /reschedule/i)
    assert.match(body!, /STOP to opt out/i)
  })

  it('booked without a captured time still confirms without inventing one', () => {
    const body = getOutboundLeadSmsTemplate('booked', base)
    assert.ok(body)
    assert.match(body!, /confirming your chat with one of our agents\./)
    assert.doesNotMatch(body!, /for null/i)
  })

  it('missed (vm/no-answer) → instant list-landed text', () => {
    const body = getOutboundLeadSmsTemplate('missed', { ...base, callerName: 'Sarah' })
    assert.ok(body)
    assert.match(body!, /Sarah/)
    assert.match(body!, /home list just landed in your email/i)
    assert.match(body!, /text back/i)
    assert.match(body!, /STOP to opt out/i)
  })

  it('answered but not booked → NO text (browsing leads get nothing extra)', () => {
    assert.equal(getOutboundLeadSmsTemplate('answered', base), null)
  })

  it('never uses inbound "thanks for calling" phrasing — we dialed them', () => {
    for (const outcome of ['booked', 'missed'] as const) {
      const body = getOutboundLeadSmsTemplate(outcome, base)
      assert.ok(body)
      assert.doesNotMatch(body!, /thanks for calling/i)
      assert.doesNotMatch(body!, /missed your call/i)
    }
  })

  it('falls back gracefully when agentName is missing', () => {
    const body = getOutboundLeadSmsTemplate('missed', { businessName: "Hasan Sharif's office" })
    assert.ok(body)
    assert.match(body!, /it's Hasan Sharif's office —/)
  })
})
