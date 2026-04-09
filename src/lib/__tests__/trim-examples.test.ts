/**
 * trim-examples.test.ts — P0.4 helper unit tests
 *
 * Covers `trimToFirstTwoExamples` behavior used by INLINE_EXAMPLES slot to
 * cut niche example blocks from 5 (A-E) down to 2 (A+B) while preserving
 * any later example flagged as life-safety.
 *
 * Run: npx tsx --test src/lib/__tests__/trim-examples.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { trimToFirstTwoExamples } from '../prompt-slots.js'

describe('trimToFirstTwoExamples', () => {
  test('keeps A+B when 2 examples present (no-op)', () => {
    const input = `Example A — foo
Body A

Example B — bar
Body B`
    const result = trimToFirstTwoExamples(input)
    assert.strictEqual(result, input, 'two-example input should pass through unchanged')
  })

  test('trims A-E to A+B when no safety markers', () => {
    const input = `Example A — happy path
A body

Example B — price question
B body

Example C — speaks to human
C body

Example D — confused caller
D body

Example E — spam
E body`
    const result = trimToFirstTwoExamples(input)
    assert.ok(result.includes('Example A'), 'A should be kept')
    assert.ok(result.includes('Example B'), 'B should be kept')
    assert.ok(!result.includes('Example C'), 'C should be dropped')
    assert.ok(!result.includes('Example D'), 'D should be dropped')
    assert.ok(!result.includes('Example E'), 'E should be dropped')
  })

  test('preserves Example D when it contains "9-1-1"', () => {
    const input = `Example A — normal
A body

Example B — normal
B body

Example C — normal
C body

Example D — gas smell (life safety):
Caller: "I smell gas"
You: "call 9-1-1 right now"

Example E — normal
E body`
    const result = trimToFirstTwoExamples(input)
    assert.ok(result.includes('Example A'), 'A should be kept')
    assert.ok(result.includes('Example B'), 'B should be kept')
    assert.ok(!result.includes('Example C'), 'C should be dropped (no safety marker)')
    assert.ok(result.includes('Example D'), 'D should be kept (contains 9-1-1)')
    assert.ok(!result.includes('Example E'), 'E should be dropped')
  })

  test('preserves example with "gas company" keyword', () => {
    const input = `Example A — normal
A body

Example B — normal
B body

Example C — urgent gas smell (call your gas company emergency line first):
C body with gas company emergency line reference`
    const result = trimToFirstTwoExamples(input)
    assert.ok(result.includes('Example A'), 'A should be kept')
    assert.ok(result.includes('Example B'), 'B should be kept')
    assert.ok(result.includes('Example C'), 'C should be kept (contains "gas company")')
  })

  test('preserves example with "emergency line" keyword', () => {
    const input = `Example A — a

Example B — b

Example C — c

Example D — call the emergency line immediately
body`
    const result = trimToFirstTwoExamples(input)
    assert.ok(result.includes('Example A'))
    assert.ok(result.includes('Example B'))
    assert.ok(!result.includes('Example C'))
    assert.ok(result.includes('Example D'), 'emergency line keyword should preserve')
  })

  test('preserves example with "life safety" keyword (case-insensitive)', () => {
    const input = `Example A — a

Example B — b

Example D — LIFE SAFETY bypass
body`
    const result = trimToFirstTwoExamples(input)
    assert.ok(result.includes('Example D'), 'Life safety keyword should preserve (case-insensitive)')
  })

  test('returns unchanged when input has fewer than 2 examples', () => {
    const input = 'Example A — only one\nbody'
    const result = trimToFirstTwoExamples(input)
    assert.strictEqual(result, input, 'single-example input should pass through')
  })

  test('returns unchanged when input has no Example markers (malformed)', () => {
    const input = 'This is just some prose with no structure.'
    const result = trimToFirstTwoExamples(input)
    assert.strictEqual(result, input, 'malformed input should pass through untouched')
  })

  test('returns unchanged when input is empty string', () => {
    const result = trimToFirstTwoExamples('')
    assert.strictEqual(result, '', 'empty input should stay empty')
  })

  test('keeps multiple safety examples if several present', () => {
    const input = `Example A — happy
a

Example B — normal
b

Example C — gas company hazard
c

Example D — fire 9-1-1 call
d

Example E — random
e`
    const result = trimToFirstTwoExamples(input)
    assert.ok(result.includes('Example A'))
    assert.ok(result.includes('Example B'))
    assert.ok(result.includes('Example C'), 'C has "gas company"')
    assert.ok(result.includes('Example D'), 'D has "9-1-1"')
    assert.ok(!result.includes('Example E'), 'E has no safety marker')
  })
})
