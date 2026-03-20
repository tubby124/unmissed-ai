import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTime, toPreferredTime, requestedTimeMatchesSlot } from '../calendar-time.js'

// ── normalizeTime ────────────────────────────────────────────────────────────

describe('normalizeTime', () => {
  it('passes through already-standard "H:MM AM/PM"', () => {
    assert.equal(normalizeTime('3:00 PM'), '3:00 PM')
    assert.equal(normalizeTime('9:30 AM'), '9:30 AM')
    assert.equal(normalizeTime('12:00 PM'), '12:00 PM')
    assert.equal(normalizeTime('12:00 AM'), '12:00 AM')
  })

  it('strips leading zero from hour in standard format', () => {
    assert.equal(normalizeTime('09:30 AM'), '9:30 AM')
  })

  it('normalizes compact "H:MMam/pm" (no space)', () => {
    assert.equal(normalizeTime('3:00pm'), '3:00 PM')
    assert.equal(normalizeTime('9:30am'), '9:30 AM')
    assert.equal(normalizeTime('1:30PM'), '1:30 PM')
  })

  it('normalizes short "Ham/pm" (no minutes)', () => {
    assert.equal(normalizeTime('9am'), '9:00 AM')
    assert.equal(normalizeTime('1pm'), '1:00 PM')
    assert.equal(normalizeTime('12PM'), '12:00 PM')
  })

  it('converts 24-hour "HH:MM" to 12-hour', () => {
    assert.equal(normalizeTime('13:00'), '1:00 PM')
    assert.equal(normalizeTime('09:00'), '9:00 AM')
    assert.equal(normalizeTime('00:00'), '12:00 AM')
    assert.equal(normalizeTime('12:00'), '12:00 PM')
    assert.equal(normalizeTime('23:30'), '11:30 PM')
    assert.equal(normalizeTime('15:45'), '3:45 PM')
  })

  it('passes through unrecognized strings', () => {
    assert.equal(normalizeTime('random text'), 'random text')
    assert.equal(normalizeTime('Friday March 20 at 2:00 PM'), 'Friday March 20 at 2:00 PM')
  })
})

// ── toPreferredTime ──────────────────────────────────────────────────────────

describe('toPreferredTime', () => {
  it('converts standard "H:MM PM" to 24h', () => {
    assert.equal(toPreferredTime('3:00 PM'), '15:00')
    assert.equal(toPreferredTime('9:30 AM'), '09:30')
    assert.equal(toPreferredTime('1:30 PM'), '13:30')
  })

  it('handles noon and midnight edge cases', () => {
    assert.equal(toPreferredTime('12:00 PM'), '12:00')
    assert.equal(toPreferredTime('12:00 AM'), '00:00')
    assert.equal(toPreferredTime('12:30 AM'), '00:30')
  })

  it('converts compact "H:MMpm" format', () => {
    assert.equal(toPreferredTime('3:00pm'), '15:00')
    assert.equal(toPreferredTime('9:00am'), '09:00')
  })

  it('converts short "Ham" format', () => {
    assert.equal(toPreferredTime('9am'), '09:00')
    assert.equal(toPreferredTime('1pm'), '13:00')
  })

  it('converts military "HH:MM" format via normalizeTime', () => {
    assert.equal(toPreferredTime('13:00'), '13:00')
    assert.equal(toPreferredTime('09:00'), '09:00')
  })

  it('extracts time from full displayTime string', () => {
    assert.equal(toPreferredTime('Friday March 20 at 2:00 PM'), '14:00')
    assert.equal(toPreferredTime('Monday, January 5 at 9:30 AM'), '09:30')
  })

  it('returns undefined for unparseable input', () => {
    assert.equal(toPreferredTime('random text'), undefined)
    assert.equal(toPreferredTime(''), undefined)
    assert.equal(toPreferredTime('next week'), undefined)
  })
})

// ── requestedTimeMatchesSlot ─────────────────────────────────────────────────

describe('requestedTimeMatchesSlot', () => {
  const slot = {
    displayTime: 'Friday, March 20 at 3:00 PM',
    start: '2026-03-20T15:00:00.000Z',
  }

  it('matches when requested time is a substring of displayTime', () => {
    assert.equal(requestedTimeMatchesSlot('3:00 PM', slot), true)
  })

  it('is case-insensitive', () => {
    assert.equal(requestedTimeMatchesSlot('3:00 pm', slot), true)
  })

  it('matches when requested time appears in slot.start ISO string', () => {
    assert.equal(requestedTimeMatchesSlot('15:00', slot), true)
  })

  it('returns false when time does not match', () => {
    assert.equal(requestedTimeMatchesSlot('2:00 PM', slot), false)
    assert.equal(requestedTimeMatchesSlot('4:00 PM', slot), false)
  })

  it('returns false for null/undefined requestedTime', () => {
    assert.equal(requestedTimeMatchesSlot(null, slot), false)
    assert.equal(requestedTimeMatchesSlot(undefined, slot), false)
  })

  it('returns false for undefined slot', () => {
    assert.equal(requestedTimeMatchesSlot('3:00 PM', undefined), false)
  })
})
