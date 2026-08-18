import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getOutboundLeadSmsTemplate } from '../sms-templates.js'
import { resolveRealtorCallbackConfirmationTime } from '../completed-notifications.js'

// Post-call SMS lanes for outbound lead-qualification calls.
// Generic outbound behavior stays intact; realtor_lofty_revival is a stricter,
// truthful, campaign-aware policy for Lofty buyer revival calls.

describe('getOutboundLeadSmsTemplate — generic outbound', () => {
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

  it('booked without a captured time still confirms without inventing one for generic outbound', () => {
    const body = getOutboundLeadSmsTemplate('booked', base)
    assert.ok(body)
    assert.match(body!, /confirming your chat with one of our agents\./)
    assert.doesNotMatch(body!, /for null/i)
  })

  it('missed (vm/no-answer) → existing instant list-landed text for generic outbound only', () => {
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

  it('generic booked SMS still preserves broad verbal timing behavior', () => {
    const body = getOutboundLeadSmsTemplate('booked', {
      ...base,
      callerName: 'Alex',
      appointmentTime: 'afternoon',
    })
    assert.ok(body)
    assert.match(body!, /for afternoon/)
  })

  it('falls back gracefully when agentName is missing', () => {
    const body = getOutboundLeadSmsTemplate('missed', { businessName: "Hasan Sharif's office" })
    assert.ok(body)
    assert.match(body!, /it's Hasan Sharif's office —/)
  })
})

describe('getOutboundLeadSmsTemplate — realtor_lofty_revival safety policy', () => {
  const realtor = {
    businessName: "Hasan Sharif's office",
    agentName: 'Aisha',
    campaignType: 'realtor_lofty_revival' as const,
  }

  it('answered with no booking sends no automatic SMS', () => {
    assert.equal(getOutboundLeadSmsTemplate('answered', realtor), null)
  })

  it('DNC, wrong number, and not-looking are suppression-only with no marketing SMS', () => {
    for (const outcome of ['do_not_call', 'wrong_number', 'not_looking'] as const) {
      assert.equal(getOutboundLeadSmsTemplate(outcome, realtor), null)
    }
  })

  it('no-answer defaults to no text for Realtor Lofty revival', () => {
    assert.equal(getOutboundLeadSmsTemplate('missed', { ...realtor, callerName: 'Sarah' }), null)
  })

  it('no-answer text requires explicit campaign opt-in and uses exact neutral copy', () => {
    const body = getOutboundLeadSmsTemplate('missed', {
      ...realtor,
      callerName: 'Sarah Jones',
      sendMissedCallText: true,
    })
    assert.equal(
      body,
      'Hi Sarah, Aisha called for Hasan Sharif with eXp Realty about your home search. No rush—reply here if you’re still planning a move, or reply STOP to opt out.'
    )
  })

  it('booked/requested callback confirmation requires an actually captured time', () => {
    assert.equal(getOutboundLeadSmsTemplate('booked', { ...realtor, callerName: 'Jacob' }), null)

    const body = getOutboundLeadSmsTemplate('booked', {
      ...realtor,
      callerName: 'Jacob',
      appointmentTime: 'Friday at 3 PM',
    })
    assert.ok(body)
    assert.match(body!, /Jacob/)
    assert.match(body!, /confirming your requested callback for Friday at 3 PM/i)
    assert.match(body!, /Reply STOP to opt out/)
  })

  it('completed webhook adapter rejects afternoon-only callback preference for Realtor confirmation SMS', () => {
    const appointmentTime = resolveRealtorCallbackConfirmationTime({
      appointmentTime: null,
      callbackPreference: 'afternoon',
    })
    assert.equal(appointmentTime, null)
    assert.equal(getOutboundLeadSmsTemplate('booked', {
      ...realtor,
      callerName: 'Jacob',
      appointmentTime,
    }), null)
  })

  it('completed webhook adapter allows concrete Realtor callback times through to confirmation SMS', () => {
    const appointmentTime = resolveRealtorCallbackConfirmationTime({
      appointmentTime: null,
      callbackPreference: 'Friday at 3 PM',
    })
    assert.equal(appointmentTime, 'Friday at 3 PM')

    const body = getOutboundLeadSmsTemplate('booked', {
      ...realtor,
      callerName: 'Jacob',
      appointmentTime,
    })
    assert.ok(body)
    assert.match(body!, /confirming your requested callback for Friday at 3 PM/i)
  })

  it('completed webhook adapter prefers structured concrete appointment time over broad callback preference', () => {
    assert.equal(resolveRealtorCallbackConfirmationTime({
      appointmentTime: '2026-08-21T15:00:00-06:00',
      callbackPreference: 'afternoon',
    }), '2026-08-21T15:00:00-06:00')
  })

  it('verified listing/search link text requires both supplied URL and honest name', () => {
    assert.equal(getOutboundLeadSmsTemplate('requested_listing', {
      ...realtor,
      verifiedSearchUrl: 'https://hasansharif.ca/search/bowness',
    }), null)
    assert.equal(getOutboundLeadSmsTemplate('requested_listing', {
      ...realtor,
      verifiedSearchName: 'Bowness homes',
    }), null)
    assert.equal(getOutboundLeadSmsTemplate('requested_listing', {
      ...realtor,
      verifiedSearchName: 'Bowness homes',
      verifiedSearchUrl: 'javascript:alert(1)',
    }), null)

    const body = getOutboundLeadSmsTemplate('requested_listing', {
      ...realtor,
      callerName: 'Maya',
      verifiedSearchName: 'Bowness homes',
      verifiedSearchUrl: 'https://hasansharif.ca/search/bowness',
    })
    assert.ok(body)
    assert.match(body!, /Bowness homes search link you requested: https:\/\/hasansharif\.ca\/search\/bowness/)
  })

  it('Realtor mode eliminates false inbound/list-landed claims', () => {
    const bodies = [
      getOutboundLeadSmsTemplate('missed', { ...realtor, callerName: 'Sarah', sendMissedCallText: true }),
      getOutboundLeadSmsTemplate('booked', { ...realtor, callerName: 'Jacob', appointmentTime: 'Friday at 3 PM' }),
      getOutboundLeadSmsTemplate('requested_listing', {
        ...realtor,
        callerName: 'Maya',
        verifiedSearchName: 'Bowness homes',
        verifiedSearchUrl: 'https://hasansharif.ca/search/bowness',
      }),
    ].filter(Boolean) as string[]

    for (const body of bodies) {
      assert.doesNotMatch(body, /Thanks for calling/i)
      assert.doesNotMatch(body, /home list just landed/i)
    }
  })
})
