import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhoneNA, isValidE164NA } from '../utils/phone'

describe('normalizePhoneNA', () => {
  it('normalizes 10-digit NA number', () => {
    assert.equal(normalizePhoneNA('6045551234'), '+16045551234')
  })

  it('normalizes 10-digit with formatting', () => {
    assert.equal(normalizePhoneNA('(604) 555-1234'), '+16045551234')
    assert.equal(normalizePhoneNA('604-555-1234'), '+16045551234')
    assert.equal(normalizePhoneNA('604.555.1234'), '+16045551234')
    assert.equal(normalizePhoneNA('604 555 1234'), '+16045551234')
  })

  it('normalizes 11-digit with leading 1', () => {
    assert.equal(normalizePhoneNA('16045551234'), '+16045551234')
    assert.equal(normalizePhoneNA('1-604-555-1234'), '+16045551234')
  })

  it('normalizes +1 prefix', () => {
    assert.equal(normalizePhoneNA('+16045551234'), '+16045551234')
    assert.equal(normalizePhoneNA('+1 (604) 555-1234'), '+16045551234')
    assert.equal(normalizePhoneNA('+1-604-555-1234'), '+16045551234')
  })

  it('rejects numbers starting with 0 or 1 area code', () => {
    assert.equal(normalizePhoneNA('0045551234'), '')
    assert.equal(normalizePhoneNA('1045551234'), '')
  })

  it('rejects too-short numbers', () => {
    assert.equal(normalizePhoneNA('604555'), '')
    assert.equal(normalizePhoneNA('12345'), '')
  })

  it('rejects too-long numbers', () => {
    assert.equal(normalizePhoneNA('160455512345'), '')
  })

  it('rejects empty string', () => {
    assert.equal(normalizePhoneNA(''), '')
  })

  it('rejects non-NA international numbers', () => {
    assert.equal(normalizePhoneNA('+442071234567'), '')
    assert.equal(normalizePhoneNA('+8613800138000'), '')
  })

  it('handles Twilio E.164 format passthrough', () => {
    // Twilio always sends +1XXXXXXXXXX — should normalize cleanly
    assert.equal(normalizePhoneNA('+13065551234'), '+13065551234')
    assert.equal(normalizePhoneNA('+14165559999'), '+14165559999')
  })
})

describe('isValidE164NA', () => {
  it('accepts valid E.164 NA numbers', () => {
    assert.equal(isValidE164NA('+16045551234'), true)
    assert.equal(isValidE164NA('+13065559999'), true)
  })

  it('rejects non-E.164 formats', () => {
    assert.equal(isValidE164NA('6045551234'), false)
    assert.equal(isValidE164NA('604-555-1234'), false)
    assert.equal(isValidE164NA('+442071234567'), false)
  })

  it('rejects invalid area codes', () => {
    assert.equal(isValidE164NA('+10045551234'), false)
    assert.equal(isValidE164NA('+11045551234'), false)
  })
})
