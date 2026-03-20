import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultCallState,
  parseCallState,
  setStateUpdate,
  slotInstruction,
  bookingInstruction,
  knowledgeInstruction,
  type CallState,
} from '../call-state.js'

// ── defaultCallState ────────────────────────────────────────────────────────

describe('defaultCallState', () => {
  it('returns support for unknown niche', () => {
    const s = defaultCallState()
    assert.equal(s.workflowType, 'support')
    assert.equal(s.step, 0)
    assert.deepEqual(s.fieldsCollected, [])
    assert.equal(s.escalationFlag, false)
    assert.equal(s.slotAttempts, 0)
    assert.equal(s.bookingAttempts, 0)
    assert.equal(s.knowledgeQueries, 0)
    assert.equal(s.lastToolOutcome, null)
  })

  it('maps auto_glass → intake', () => {
    assert.equal(defaultCallState('auto_glass').workflowType, 'intake')
  })

  it('maps real_estate → triage', () => {
    assert.equal(defaultCallState('real_estate').workflowType, 'triage')
  })

  it('maps property_mgmt → support', () => {
    assert.equal(defaultCallState('property_mgmt').workflowType, 'support')
  })

  it('maps voicemail → support', () => {
    assert.equal(defaultCallState('voicemail').workflowType, 'support')
  })

  it('handles null niche', () => {
    assert.equal(defaultCallState(null).workflowType, 'support')
  })
})

// ── parseCallState ──────────────────────────────────────────────────────────

describe('parseCallState', () => {
  it('returns null when header is missing', () => {
    const req = { headers: { get: () => null } }
    assert.equal(parseCallState(req), null)
  })

  it('returns null for invalid JSON', () => {
    const req = { headers: { get: (name: string) => name === 'x-call-state' ? 'not-json' : null } }
    assert.equal(parseCallState(req), null)
  })

  it('parses valid call state from header', () => {
    const state: CallState = defaultCallState('auto_glass')
    state.slotAttempts = 2
    const req = { headers: { get: (name: string) => name === 'x-call-state' ? JSON.stringify(state) : null } }
    const parsed = parseCallState(req)
    assert.ok(parsed)
    assert.equal(parsed.workflowType, 'intake')
    assert.equal(parsed.slotAttempts, 2)
  })
})

// ── setStateUpdate ──────────────────────────────────────────────────────────

describe('setStateUpdate', () => {
  it('sets X-Ultravox-Update-Call-State header with JSON', () => {
    let headerName = ''
    let headerValue = ''
    const response = { headers: { set: (n: string, v: string) => { headerName = n; headerValue = v } } }
    setStateUpdate(response, { slotAttempts: 3, lastToolOutcome: 'no_slots' })
    assert.equal(headerName, 'X-Ultravox-Update-Call-State')
    const parsed = JSON.parse(headerValue)
    assert.equal(parsed.slotAttempts, 3)
    assert.equal(parsed.lastToolOutcome, 'no_slots')
  })
})

// ── slotInstruction ─────────────────────────────────────────────────────────

describe('slotInstruction', () => {
  const base: CallState = defaultCallState()

  it('returns empty for first slot check with results', () => {
    assert.equal(slotInstruction({ ...base, slotAttempts: 1 }, true), '')
  })

  it('returns empty for first slot check without results', () => {
    assert.equal(slotInstruction({ ...base, slotAttempts: 1 }, false), '')
  })

  it('returns coaching after 2+ checks with results', () => {
    const msg = slotInstruction({ ...base, slotAttempts: 2 }, true)
    assert.ok(msg.includes('confirm which time'))
  })

  it('returns escalation coaching after 3+ checks with no results', () => {
    const msg = slotInstruction({ ...base, slotAttempts: 3 }, false)
    assert.ok(msg.includes('call them back'))
    assert.ok(msg.includes('#3'))
  })
})

// ── bookingInstruction ──────────────────────────────────────────────────────

describe('bookingInstruction', () => {
  const base: CallState = defaultCallState()

  it('returns empty when booked successfully', () => {
    assert.equal(bookingInstruction({ ...base, bookingAttempts: 5 }, true, false), '')
  })

  it('returns empty for first failed attempt', () => {
    assert.equal(bookingInstruction({ ...base, bookingAttempts: 1 }, false, true), '')
  })

  it('returns slot-taken coaching after 2+ attempts', () => {
    const msg = bookingInstruction({ ...base, bookingAttempts: 2 }, false, true)
    assert.ok(msg.includes('slot taken'))
  })

  it('returns general failure coaching after 2+ attempts', () => {
    const msg = bookingInstruction({ ...base, bookingAttempts: 2 }, false, false)
    assert.ok(msg.includes('failed'))
  })
})

// ── knowledgeInstruction ────────────────────────────────────────────────────

describe('knowledgeInstruction', () => {
  const base: CallState = defaultCallState()

  it('returns empty when results found', () => {
    assert.equal(knowledgeInstruction({ ...base, knowledgeQueries: 5 }, true), '')
  })

  it('returns empty for first miss', () => {
    assert.equal(knowledgeInstruction({ ...base, knowledgeQueries: 1 }, false), '')
  })

  it('returns coaching after 3+ misses', () => {
    const msg = knowledgeInstruction({ ...base, knowledgeQueries: 3 }, false)
    assert.ok(msg.includes('follow up'))
  })
})
