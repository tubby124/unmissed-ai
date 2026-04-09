/**
 * normalize-hours.test.ts — Phase E.5 Wave 7 regression guard
 *
 * Pins the behavior of normalize24hHours (GBP returns 24h strings like
 * "11:00-23:00"; the prompt expects 12h AM/PM). Exported from prompt-slots.ts
 * in Phase E.5 specifically so this test can anchor it.
 *
 * Run: npx tsx --test src/lib/__tests__/normalize-hours.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { normalize24hHours } from '../prompt-slots.js'

describe('Phase E.5 Wave 7 — normalize24hHours', () => {
  test('converts 24h range "09:00-17:00" → 12h AM/PM', () => {
    assert.equal(normalize24hHours('09:00-17:00'), '9:00 AM-5:00 PM')
  })

  test('pass-through when input has no HH:MM tokens ("Sat 9am-3pm")', () => {
    // No HH:MM pattern → nothing to replace → identical output.
    assert.equal(normalize24hHours('Sat 9am-3pm'), 'Sat 9am-3pm')
  })

  test('converts mixed 24h range "Mon-Fri 09:00-17:00"', () => {
    // Input uses HH:MM tokens, so they convert even though prefix is text.
    assert.equal(normalize24hHours('Mon-Fri 09:00-17:00'), 'Mon-Fri 9:00 AM-5:00 PM')
  })

  test('midnight "00:00" → "12:00 AM"', () => {
    assert.equal(normalize24hHours('00:00'), '12:00 AM')
  })

  test('noon "12:00" → "12:00 PM"', () => {
    assert.equal(normalize24hHours('12:00'), '12:00 PM')
  })

  test('23:30 → 11:30 PM', () => {
    assert.equal(normalize24hHours('23:30'), '11:30 PM')
  })

  test('handles multiple ranges on one line', () => {
    assert.equal(
      normalize24hHours('08:00-12:00, 13:00-17:00'),
      '8:00 AM-12:00 PM, 1:00 PM-5:00 PM',
    )
  })
})
