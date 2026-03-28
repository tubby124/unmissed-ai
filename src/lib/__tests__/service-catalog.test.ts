/**
 * service-catalog.test.ts
 *
 * Unit tests for service-catalog.ts pure helpers.
 * Covers:
 *   - parseServiceCatalog edge cases
 *   - formatServiceCatalog output
 *   - buildBookingNotesBlock
 *   - rowsToCatalogItems
 *   - validateServiceWrite
 *
 * Run: npx tsx --test src/lib/__tests__/service-catalog.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseServiceCatalog,
  formatServiceCatalog,
  buildBookingNotesBlock,
  rowsToCatalogItems,
  validateServiceWrite,
  type ServiceCatalogItem,
} from '../service-catalog.js'

// ── parseServiceCatalog ───────────────────────────────────────────────────────

describe('parseServiceCatalog', () => {
  test('returns [] for null', () => {
    assert.deepEqual(parseServiceCatalog(null), [])
  })

  test('returns [] for undefined', () => {
    assert.deepEqual(parseServiceCatalog(undefined), [])
  })

  test('returns [] for non-array', () => {
    assert.deepEqual(parseServiceCatalog('haircut'), [])
    assert.deepEqual(parseServiceCatalog(42), [])
    assert.deepEqual(parseServiceCatalog({}), [])
  })

  test('returns [] for empty array', () => {
    assert.deepEqual(parseServiceCatalog([]), [])
  })

  test('filters out items with no name', () => {
    const raw = [{ name: '', description: 'trimmed' }, { name: '  ', price: '$10' }]
    assert.deepEqual(parseServiceCatalog(raw), [])
  })

  test('filters out items where name is not a string', () => {
    const raw = [{ name: 42 }, { name: null }, { description: 'no name' }]
    assert.deepEqual(parseServiceCatalog(raw), [])
  })

  test('returns valid items unchanged', () => {
    const raw = [
      { name: 'Haircut', price: '$35', duration_mins: 30 },
      { name: 'Beard Trim', price: '$20' },
    ]
    const result = parseServiceCatalog(raw)
    assert.equal(result.length, 2)
    assert.equal(result[0].name, 'Haircut')
    assert.equal(result[1].name, 'Beard Trim')
  })

  test('mixed valid and invalid — filters to only valid', () => {
    const raw = [
      { name: 'Valid Service' },
      { name: '' },
      null,
      42,
      { name: 'Also Valid', price: '$50' },
    ]
    const result = parseServiceCatalog(raw)
    assert.equal(result.length, 2)
    assert.equal(result[0].name, 'Valid Service')
    assert.equal(result[1].name, 'Also Valid')
  })
})

// ── formatServiceCatalog ──────────────────────────────────────────────────────

describe('formatServiceCatalog', () => {
  test('empty array returns empty string', () => {
    assert.equal(formatServiceCatalog([]), '')
  })

  test('single item with name only', () => {
    assert.equal(formatServiceCatalog([{ name: 'Haircut' }]), 'Haircut')
  })

  test('item with duration and price', () => {
    assert.equal(
      formatServiceCatalog([{ name: 'Haircut', duration_mins: 30, price: '$35' }]),
      'Haircut (30 min · $35)',
    )
  })

  test('item with duration only (no price)', () => {
    assert.equal(
      formatServiceCatalog([{ name: 'Trim', duration_mins: 15 }]),
      'Trim (15 min)',
    )
  })

  test('item with price only (no duration)', () => {
    assert.equal(
      formatServiceCatalog([{ name: 'Consultation', price: '$50' }]),
      'Consultation ($50)',
    )
  })

  test('item with description appended', () => {
    assert.equal(
      formatServiceCatalog([{ name: 'Blowout', description: 'includes wash' }]),
      'Blowout — includes wash',
    )
  })

  test('multiple items joined by comma', () => {
    const catalog: ServiceCatalogItem[] = [
      { name: 'Haircut', duration_mins: 30, price: '$35' },
      { name: 'Beard Trim', duration_mins: 20, price: '$20' },
    ]
    assert.equal(
      formatServiceCatalog(catalog),
      'Haircut (30 min · $35), Beard Trim (20 min · $20)',
    )
  })

  test('skips items with blank names', () => {
    const catalog: ServiceCatalogItem[] = [
      { name: 'Valid' },
      { name: '   ' },
    ]
    assert.equal(formatServiceCatalog(catalog), 'Valid')
  })

  test('duration=0 is not included in meta', () => {
    assert.equal(
      formatServiceCatalog([{ name: 'Service', duration_mins: 0, price: '$10' }]),
      'Service ($10)',
    )
  })
})

// ── buildBookingNotesBlock ────────────────────────────────────────────────────

describe('buildBookingNotesBlock', () => {
  test('returns empty string when no booking_notes', () => {
    const catalog: ServiceCatalogItem[] = [
      { name: 'Haircut', price: '$35' },
      { name: 'Trim' },
    ]
    assert.equal(buildBookingNotesBlock(catalog), '')
  })

  test('returns empty string when booking_notes are blank', () => {
    const catalog: ServiceCatalogItem[] = [
      { name: 'Haircut', booking_notes: '   ' },
    ]
    assert.equal(buildBookingNotesBlock(catalog), '')
  })

  test('returns formatted block for one service with notes', () => {
    const catalog: ServiceCatalogItem[] = [
      { name: 'Color', booking_notes: 'requires patch test 48h before' },
    ]
    const block = buildBookingNotesBlock(catalog)
    assert.ok(block.includes('SERVICE NOTES'), 'must include SERVICE NOTES header')
    assert.ok(block.includes('Color: requires patch test 48h before'), 'must include service name and note')
  })

  test('includes only services that have booking_notes', () => {
    const catalog: ServiceCatalogItem[] = [
      { name: 'Haircut' },
      { name: 'Color', booking_notes: 'patch test required' },
      { name: 'Trim', booking_notes: '' },
    ]
    const block = buildBookingNotesBlock(catalog)
    assert.ok(block.includes('Color'), 'should include Color')
    assert.ok(!block.includes('Haircut'), 'should not include Haircut (no notes)')
    assert.ok(!block.includes('Trim'), 'should not include Trim (blank notes)')
  })
})

// ── rowsToCatalogItems ────────────────────────────────────────────────────────

describe('rowsToCatalogItems', () => {
  test('converts DB rows to ServiceCatalogItem shape', () => {
    const rows = [
      {
        name: 'Haircut',
        duration_mins: 30,
        price: '$35',
        description: 'Classic cut',
        category: 'Cuts',
        booking_notes: 'walk-in welcome',
      },
    ]
    const items = rowsToCatalogItems(rows)
    assert.equal(items.length, 1)
    assert.equal(items[0].name, 'Haircut')
    assert.equal(items[0].duration_mins, 30)
    assert.equal(items[0].price, '$35')
    assert.equal(items[0].description, 'Classic cut')
    assert.equal(items[0].category, 'Cuts')
    assert.equal(items[0].booking_notes, 'walk-in welcome')
  })

  test('omits null duration_mins', () => {
    const rows = [{ name: 'Service', duration_mins: null, price: '', description: '', category: '', booking_notes: '' }]
    const items = rowsToCatalogItems(rows)
    assert.ok(!('duration_mins' in items[0]), 'duration_mins should be absent when null')
  })

  test('omits blank price', () => {
    const rows = [{ name: 'Service', duration_mins: null, price: '', description: '', category: '', booking_notes: '' }]
    const items = rowsToCatalogItems(rows)
    assert.ok(!('price' in items[0]), 'price should be absent when blank')
  })

  test('omits blank description', () => {
    const rows = [{ name: 'Service', duration_mins: null, price: '', description: '', category: '', booking_notes: '' }]
    const items = rowsToCatalogItems(rows)
    assert.ok(!('description' in items[0]), 'description should be absent when blank')
  })

  test('omits blank category', () => {
    const rows = [{ name: 'Service', duration_mins: null, price: '', description: '', category: '', booking_notes: '' }]
    const items = rowsToCatalogItems(rows)
    assert.ok(!('category' in items[0]), 'category should be absent when blank')
  })

  test('omits blank booking_notes', () => {
    const rows = [{ name: 'Service', duration_mins: null, price: '', description: '', category: '', booking_notes: '' }]
    const items = rowsToCatalogItems(rows)
    assert.ok(!('booking_notes' in items[0]), 'booking_notes should be absent when blank')
  })

  test('multiple rows preserve order', () => {
    const rows = [
      { name: 'A', duration_mins: null, price: '', description: '', category: '', booking_notes: '' },
      { name: 'B', duration_mins: null, price: '', description: '', category: '', booking_notes: '' },
      { name: 'C', duration_mins: null, price: '', description: '', category: '', booking_notes: '' },
    ]
    const items = rowsToCatalogItems(rows)
    assert.deepEqual(items.map(i => i.name), ['A', 'B', 'C'])
  })
})

// ── validateServiceWrite ──────────────────────────────────────────────────────

describe('validateServiceWrite', () => {
  test('null body returns error', () => {
    assert.ok(validateServiceWrite(null) !== null)
  })

  test('non-object body returns error', () => {
    assert.ok(validateServiceWrite('string') !== null)
    assert.ok(validateServiceWrite(42) !== null)
    assert.ok(validateServiceWrite([]) !== null)
  })

  test('missing name returns error', () => {
    assert.ok(validateServiceWrite({}) !== null)
    assert.ok(validateServiceWrite({ description: 'no name' }) !== null)
  })

  test('blank name returns error', () => {
    assert.ok(validateServiceWrite({ name: '' }) !== null)
    assert.ok(validateServiceWrite({ name: '   ' }) !== null)
  })

  test('name exceeding 200 chars returns error', () => {
    assert.ok(validateServiceWrite({ name: 'x'.repeat(201) }) !== null)
  })

  test('valid minimal payload returns null', () => {
    assert.equal(validateServiceWrite({ name: 'Haircut' }), null)
  })

  test('invalid duration_mins returns error', () => {
    assert.ok(validateServiceWrite({ name: 'Service', duration_mins: 0 }) !== null)
    assert.ok(validateServiceWrite({ name: 'Service', duration_mins: -1 }) !== null)
    assert.ok(validateServiceWrite({ name: 'Service', duration_mins: 481 }) !== null)
    assert.ok(validateServiceWrite({ name: 'Service', duration_mins: 1.5 }) !== null)
  })

  test('valid duration_mins passes', () => {
    assert.equal(validateServiceWrite({ name: 'Service', duration_mins: 60 }), null)
    assert.equal(validateServiceWrite({ name: 'Service', duration_mins: 1 }), null)
    assert.equal(validateServiceWrite({ name: 'Service', duration_mins: 480 }), null)
  })

  test('null duration_mins is allowed (optional)', () => {
    assert.equal(validateServiceWrite({ name: 'Service', duration_mins: null }), null)
  })

  test('price exceeding 100 chars returns error', () => {
    assert.ok(validateServiceWrite({ name: 'Service', price: 'x'.repeat(101) }) !== null)
  })

  test('description exceeding 500 chars returns error', () => {
    assert.ok(validateServiceWrite({ name: 'Service', description: 'x'.repeat(501) }) !== null)
  })

  test('full valid payload returns null', () => {
    assert.equal(
      validateServiceWrite({
        name: 'Haircut',
        description: 'Classic cut',
        category: 'Cuts',
        duration_mins: 30,
        price: '$35',
        booking_notes: 'walk-in welcome',
        active: true,
        sort_order: 0,
      }),
      null,
    )
  })
})
