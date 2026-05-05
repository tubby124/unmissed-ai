/**
 * recompose-delta.test.ts
 *
 * Tests for D451 char-delta gate logic.
 *
 * Run: npx tsx --test src/lib/__tests__/recompose-delta.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { computeRecomposeDelta, DEFAULT_DELTA_THRESHOLD_CHARS, DEFAULT_DELTA_THRESHOLD_PCT } from '../recompose-delta.js'

function wrap(sectionId: string, body: string): string {
  return `<!-- unmissed:${sectionId} -->\n${body}\n<!-- /unmissed:${sectionId} -->`
}

function buildPrompt(sections: Record<string, string>): string {
  return Object.entries(sections).map(([k, v]) => wrap(k, v)).join('\n\n')
}

describe('computeRecomposeDelta', () => {
  test('identical prompts → zero drift, no threshold trigger', () => {
    const a = buildPrompt({ identity: 'You are Mark.', goal: 'Help callers.' })
    const result = computeRecomposeDelta(a, a, { chars: 500, pct: 5 })
    assert.equal(result.charsDropped, 0)
    assert.equal(result.charsAdded, 0)
    assert.equal(result.percentChange, 0)
    assert.equal(result.biggestDropSection, null)
    assert.equal(result.exceedsThreshold, false)
  })

  test('content lost in one section → biggestDropSection identifies it', () => {
    const stored = buildPrompt({
      identity: 'You are Mark.',
      inline_examples: 'A) Caller asks pricing → quote $250. B) Caller mentions emergency → escalate.',
    })
    const recomposed = buildPrompt({
      identity: 'You are Mark.',
      inline_examples: 'A) Caller asks pricing → quote $250.',
    })
    const result = computeRecomposeDelta(stored, recomposed, { chars: 30, pct: 100 })
    assert.equal(result.biggestDropSection, 'inline_examples')
    assert.ok(result.charsDropped >= 40, `expected >40 chars dropped, got ${result.charsDropped}`)
    assert.equal(result.exceedsThreshold, true, 'should trip char threshold')
  })

  test('Brian-class drift: 3,392 chars in inline_examples trips both gates', () => {
    const examples = 'A) '.repeat(1000) + 'fragment'.repeat(50)
    const stored = buildPrompt({ identity: 'You are Brian.', inline_examples: examples })
    const recomposed = buildPrompt({ identity: 'You are Brian.', inline_examples: '' })
    const result = computeRecomposeDelta(stored, recomposed, { chars: 500, pct: 5 })
    assert.ok(result.charsDropped > 500, `expected >500 chars dropped, got ${result.charsDropped}`)
    assert.ok(result.percentChange > 5, `expected >5% pct change, got ${result.percentChange}`)
    assert.equal(result.exceedsThreshold, true)
    assert.equal(result.biggestDropSection, 'inline_examples')
    assert.equal(result.topDropSections.length, 1)
  })

  test('clean slot-pipeline change (cosmetic): low chars + low pct → no trigger', () => {
    const stored = buildPrompt({ identity: 'You are Mark, the receptionist for Windshield Hub.' })
    const recomposed = buildPrompt({ identity: 'You are Mark, receptionist at Windshield Hub.' })
    const result = computeRecomposeDelta(stored, recomposed, { chars: 500, pct: 5 })
    assert.equal(result.exceedsThreshold, false, 'tiny rewording should not trip threshold')
  })

  test('only pct gate trips (small absolute, large relative)', () => {
    const stored = buildPrompt({ identity: 'AAAAAAAAAA' }) // 10 chars
    const recomposed = buildPrompt({ identity: 'A' }) // 1 char
    const result = computeRecomposeDelta(stored, recomposed, { chars: 1000, pct: 5 })
    assert.equal(result.charsDropped >= 9, true)
    assert.ok(result.percentChange > 5, `expected >5%, got ${result.percentChange}`)
    assert.equal(result.exceedsThreshold, true, 'should trip pct threshold even though char count is small')
  })

  test('top 3 sections by drop are returned in descending drop order', () => {
    const big = 'X'.repeat(1000)
    const med = 'Y'.repeat(300)
    const sml = 'Z'.repeat(50)
    const stored = buildPrompt({
      inline_examples: big,
      faq_pairs: med,
      identity: sml,
      goal: 'Same.',
    })
    const recomposed = buildPrompt({
      inline_examples: '',
      faq_pairs: '',
      identity: '',
      goal: 'Same.',
    })
    const result = computeRecomposeDelta(stored, recomposed)
    assert.equal(result.topDropSections.length, 3)
    assert.equal(result.topDropSections[0].sectionId, 'inline_examples')
    assert.equal(result.topDropSections[1].sectionId, 'faq_pairs')
    assert.equal(result.topDropSections[2].sectionId, 'identity')
  })

  test('default thresholds match D451 spec (500 chars / 5%)', () => {
    assert.equal(DEFAULT_DELTA_THRESHOLD_CHARS, 500)
    assert.equal(DEFAULT_DELTA_THRESHOLD_PCT, 5)
  })

  test('additive-only change (recompose adds content) → no chars dropped, no trigger', () => {
    const stored = buildPrompt({ identity: 'You are Sam.' })
    const recomposed = buildPrompt({ identity: 'You are Sam.', goal: 'Help everyone.' })
    const result = computeRecomposeDelta(stored, recomposed, { chars: 500, pct: 50 })
    assert.equal(result.charsDropped, 0)
    assert.ok(result.charsAdded > 0)
    assert.equal(result.biggestDropSection, null)
    assert.equal(result.exceedsThreshold, false, 'pure additive should not trip char gate')
  })
})
