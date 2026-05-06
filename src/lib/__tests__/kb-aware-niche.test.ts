import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NICHE_REGISTRY, getKbStance } from '../niche-registry'

test('strict niches get kbStance=strict', () => {
  assert.equal(getKbStance('property_management'), 'strict')
  assert.equal(getKbStance('legal'), 'strict')
  assert.equal(getKbStance('real_estate'), 'strict')
  assert.equal(getKbStance('dental'), 'strict')
})

test('permissive niches get kbStance=permissive', () => {
  assert.equal(getKbStance('auto_glass'), 'permissive')
  assert.equal(getKbStance('hvac'), 'permissive')
  assert.equal(getKbStance('restaurant'), 'permissive')
  assert.equal(getKbStance('salon'), 'permissive')
  assert.equal(getKbStance('barbershop'), 'permissive')
})

test('unknown niches default to permissive', () => {
  assert.equal(getKbStance('made_up_niche'), 'permissive')
})

test('every NICHE_REGISTRY entry has a kbStance', () => {
  for (const key of Object.keys(NICHE_REGISTRY)) {
    const stance = getKbStance(key)
    assert.ok(stance === 'strict' || stance === 'permissive',
      `${key} missing or invalid kbStance: ${stance}`)
  }
})

test('hyphenated DB slugs route through norm() to underscored keys', () => {
  assert.equal(getKbStance('property-management'), 'strict')
  assert.equal(getKbStance('real-estate'), 'strict')
  assert.equal(getKbStance('auto-glass'), 'permissive')
})

test('null/undefined niche values default to permissive', () => {
  assert.equal(getKbStance(null), 'permissive')
  assert.equal(getKbStance(undefined), 'permissive')
})
