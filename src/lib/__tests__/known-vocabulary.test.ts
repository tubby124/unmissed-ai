import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildKnownVocabularyBlock } from '../known-vocabulary.js'

test('returns empty string when serviceAreas is null', () => {
  assert.equal(buildKnownVocabularyBlock(null), '')
})

test('returns empty string when serviceAreas is empty array', () => {
  assert.equal(buildKnownVocabularyBlock([]), '')
})

test('returns empty string when serviceAreas contains only unknown cities', () => {
  assert.equal(buildKnownVocabularyBlock(['Atlantis', 'Wakanda']), '')
})

test('renders Calgary neighborhoods when Calgary is in serviceAreas', () => {
  const block = buildKnownVocabularyBlock(['Calgary'])
  assert.match(block, /^## Known Vocabulary/)
  assert.match(block, /Calgary:/)
  assert.match(block, /Nolan Hill/)
  assert.match(block, /Mahogany/)
})

test('renders multiple cities when serviceAreas has more than one', () => {
  const block = buildKnownVocabularyBlock(['Calgary', 'Edmonton'])
  assert.match(block, /Calgary:/)
  assert.match(block, /Edmonton:/)
  assert.match(block, /Nolan Hill/)
})

test('handles whitespace + casing in city names without crashing', () => {
  // Trims but does not lowercase — keys are case-sensitive (e.g. "Calgary", not "calgary")
  const block = buildKnownVocabularyBlock(['  Calgary  '])
  assert.match(block, /Calgary:/)
})

test('caps each city at 300 terms (defensive, current cities all fit)', () => {
  const block = buildKnownVocabularyBlock(['Calgary'])
  const calgaryLine = block.split('\n').find(l => l.startsWith('- Calgary:'))
  assert.ok(calgaryLine, 'Calgary line should exist')
  const names = calgaryLine!.replace('- Calgary: ', '').split(', ')
  assert.ok(names.length <= 300, `expected <=300 terms, got ${names.length}`)
})

test('includes Nolan Hill — the trigger neighborhood for this feature', () => {
  // Regression test for the bug that made tests fail in the first commit:
  // MAX_TERMS_PER_CITY=80 cut Calgary alphabetically before "Nolan Hill" (idx 124).
  const block = buildKnownVocabularyBlock(['Calgary'])
  assert.match(block, /Nolan Hill/, 'Nolan Hill must be in injected vocabulary — this neighborhood triggered the entire feature')
})

test('skips unknown cities when intermixed with known cities', () => {
  const block = buildKnownVocabularyBlock(['Calgary', 'Atlantis', 'Saskatoon'])
  assert.match(block, /Calgary:/)
  assert.match(block, /Saskatoon:/)
  assert.doesNotMatch(block, /Atlantis/)
})

test('logs unmapped cities so unmapped Canadian cities surface in Railway logs', () => {
  const warnings: string[] = []
  const orig = console.warn
  console.warn = (msg: string) => { warnings.push(String(msg)) }
  try {
    buildKnownVocabularyBlock(['Calgary', 'Lethbridge', 'Red Deer'])
  } finally {
    console.warn = orig
  }
  assert.equal(warnings.length, 1, 'one consolidated warning per call')
  assert.match(warnings[0], /\[anchor-pack\] unmapped/)
  assert.match(warnings[0], /Lethbridge/)
  assert.match(warnings[0], /Red Deer/)
  assert.doesNotMatch(warnings[0], /Calgary/, 'mapped cities must not appear in unmapped warning')
})

test('does NOT log when all cities are mapped', () => {
  const warnings: string[] = []
  const orig = console.warn
  console.warn = (msg: string) => { warnings.push(String(msg)) }
  try {
    buildKnownVocabularyBlock(['Calgary', 'Edmonton'])
  } finally {
    console.warn = orig
  }
  assert.equal(warnings.length, 0, 'no warning when every city is mapped')
})
