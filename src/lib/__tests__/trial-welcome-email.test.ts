/**
 * Tests for buildTrialWelcomeEmail (pure builder — no Resend, no DB).
 *
 * Key truth assertions:
 * - carrier section: correct filled enable codes per carrier when a number exists,
 *   placeholder rendering when trial has no number, omitted when carrier unknown
 * - greeting: contact first name + business name present
 * - agent name: used when set, graceful "Your agent" fallback when null
 * - login link: /login?email=... with the recipient email URL-encoded
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { buildTrialWelcomeEmail, type TrialWelcomeParams } from '../email/trial-welcome'

// ── Base fixture ──────────────────────────────────────────────────────────────

function base(): TrialWelcomeParams {
  return {
    to: 'owner@example.com',
    contactName: 'Aman Walia',
    businessName: 'Walia Family Real Estate',
    agentName: 'Riley',
    clientId: 'client-uuid',
    clientSlug: 'walia-family',
    carrierId: null,
    twilioNumber: null,
    trialDays: 7,
  }
}

// ── Greeting + identity ───────────────────────────────────────────────────────

describe('greeting and identity', () => {
  test('greets with contact first name only', () => {
    const { html } = buildTrialWelcomeEmail(base())
    assert.match(html, /Your AI receptionist is live, Aman\./)
    assert.doesNotMatch(html, /live, Aman Walia/)
  })

  test('no contact name → greeting without name', () => {
    const { html } = buildTrialWelcomeEmail({ ...base(), contactName: null })
    assert.match(html, /Your AI receptionist is live\./)
  })

  test('business name appears in the lead', () => {
    const { html } = buildTrialWelcomeEmail(base())
    assert.match(html, /Walia Family Real Estate/)
  })

  test('agent name appears in subject and body', () => {
    const { subject, html } = buildTrialWelcomeEmail(base())
    assert.match(subject, /Riley is live/)
    assert.match(html, /Test Riley right now/)
  })

  test('null agent name → "Your agent" fallback, generic subject', () => {
    const { subject, html } = buildTrialWelcomeEmail({ ...base(), agentName: null })
    assert.match(subject, /Your AI agent is live/)
    assert.match(html, /Test Your agent right now/)
  })

  test('HTML-escapes business name', () => {
    const { html } = buildTrialWelcomeEmail({ ...base(), businessName: 'Bob & Sons <Glass>' })
    assert.match(html, /Bob &amp; Sons &lt;Glass&gt;/)
    assert.doesNotMatch(html, /<Glass>/)
  })
})

// ── Login link ────────────────────────────────────────────────────────────────

describe('login link', () => {
  test('points to /login with the recipient email pre-filled', () => {
    const { html } = buildTrialWelcomeEmail(base())
    assert.match(html, /\/login\?email=owner%40example\.com/)
  })
})

// ── Carrier forwarding section ────────────────────────────────────────────────

describe('carrier forwarding codes', () => {
  test('no carrierId → no forwarding section', () => {
    const { html } = buildTrialWelcomeEmail({ ...base(), carrierId: null })
    assert.doesNotMatch(html, /Forward your/)
    assert.doesNotMatch(html, /\*61\*/)
  })

  test('unknown carrierId → graceful skip, no forwarding section', () => {
    const { html } = buildTrialWelcomeEmail({ ...base(), carrierId: 'not-a-carrier' })
    assert.doesNotMatch(html, /Forward your/)
    assert.doesNotMatch(html, /\*61\*/)
  })

  test('rogers + number → filled GSM enable codes (no leading +) and carrier name', () => {
    const { html } = buildTrialWelcomeEmail({
      ...base(),
      carrierId: 'rogers',
      twilioNumber: '+15878728187',
    })
    assert.match(html, /Forward your Rogers line/)
    assert.match(html, /\*61\*15878728187#/)
    assert.match(html, /\*67\*15878728187#/)
    assert.match(html, /\*62\*15878728187#/)
  })

  test('telus + number → same GSM codes, Telus name', () => {
    const { html } = buildTrialWelcomeEmail({
      ...base(),
      carrierId: 'telus',
      twilioNumber: '+14035551234',
    })
    assert.match(html, /Forward your Telus line/)
    assert.match(html, /\*61\*14035551234#/)
  })

  test('deactivation codes always included with carrier section', () => {
    const { html } = buildTrialWelcomeEmail({
      ...base(),
      carrierId: 'bell',
      twilioNumber: '+14035551234',
    })
    assert.match(html, /##61#/)
    assert.match(html, /##67#/)
    assert.match(html, /##62#/)
  })

  test('carrier known but no number (trial) → placeholder codes, no raw {number}', () => {
    const { html } = buildTrialWelcomeEmail({ ...base(), carrierId: 'koodo', twilioNumber: null })
    assert.match(html, /Forward your Koodo line/)
    assert.match(html, /\*61\*&lt;your AI number&gt;#/)
    assert.doesNotMatch(html, /\{number\}/)
    // Explains the number arrives at activation
    assert.match(html, /assigned when you activate/)
  })

  test("'other' carrier → includes the contact-your-carrier note", () => {
    const { html } = buildTrialWelcomeEmail({
      ...base(),
      carrierId: 'other',
      twilioNumber: '+14035551234',
    })
    assert.match(html, /contact their support/)
  })

  test('framing is "when ready for real calls", not a day-one demand', () => {
    const { html } = buildTrialWelcomeEmail({ ...base(), carrierId: 'rogers' })
    assert.match(html, /When you&#39;re ready for real calls|When you're ready for real calls/)
  })
})

// ── Trial inclusions ──────────────────────────────────────────────────────────

describe('trial inclusions', () => {
  test('mentions the 7-day trial by default', () => {
    const { html } = buildTrialWelcomeEmail(base())
    assert.match(html, /7-day trial/)
  })

  test('respects a custom trialDays', () => {
    const { html } = buildTrialWelcomeEmail({ ...base(), trialDays: 14 })
    assert.match(html, /14-day trial/)
  })

  test('lists dashboard + browser test calls', () => {
    const { html } = buildTrialWelcomeEmail(base())
    assert.match(html, /browser test calls/i)
    assert.match(html, /dashboard/i)
  })
})
