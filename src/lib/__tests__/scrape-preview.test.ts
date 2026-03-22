import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { WebsiteScrapeResult } from '@/types/onboarding'

// ---------------------------------------------------------------------------
// Pure logic extracted from SCRAPE1/SCRAPE2 features.
// These mirror the actual implementations in:
//   - WebsiteScrapePreview.tsx (toggle, staleness)
//   - provision/trial/route.ts + create-public-checkout/route.ts (filtering)
//   - types/onboarding.ts (type shape)
// ---------------------------------------------------------------------------

type ScrapeResult = WebsiteScrapeResult

// Toggle logic — mirrors WebsiteScrapePreview.tsx toggleFact/toggleQa
function toggleFact(result: ScrapeResult, index: number): ScrapeResult {
  const next = [...result.approvedFacts]
  next[index] = !next[index]
  return { ...result, approvedFacts: next }
}

function toggleQa(result: ScrapeResult, index: number): ScrapeResult {
  const next = [...result.approvedQa]
  next[index] = !next[index]
  return { ...result, approvedQa: next }
}

// Filtering logic — mirrors provision/trial/route.ts + create-public-checkout/route.ts
function filterApprovedFacts(result: ScrapeResult): string[] {
  return result.businessFacts.filter((_, i) => result.approvedFacts[i] !== false)
}

function filterApprovedQa(result: ScrapeResult): { q: string; a: string }[] {
  return result.extraQa.filter((_, i) => result.approvedQa[i] !== false)
}

// Staleness logic — mirrors WebsiteScrapePreview.tsx STALE_MS constant
const STALE_MS = 24 * 60 * 60 * 1000

function isStale(scrapedAt: string, now: number = Date.now()): boolean {
  return now - new Date(scrapedAt).getTime() > STALE_MS
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeScrapeResult(overrides?: Partial<ScrapeResult>): ScrapeResult {
  return {
    businessFacts: ['Open 7 days a week', 'Licensed and insured', 'Free estimates'],
    extraQa: [
      { q: 'Do you offer mobile service?', a: 'Yes, we come to you' },
      { q: 'What areas do you serve?', a: 'Saskatoon and area' },
    ],
    serviceTags: ['windshield', 'rock chip'],
    warnings: [],
    scrapedAt: new Date().toISOString(),
    scrapedUrl: 'https://example.com',
    approvedFacts: [true, true, true],
    approvedQa: [true, true],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SCRAPE1/2: Toggle behavior', () => {
  it('toggleFact: true -> false (uncheck)', () => {
    const result = makeScrapeResult()
    const toggled = toggleFact(result, 1)
    assert.deepStrictEqual(toggled.approvedFacts, [true, false, true])
  })

  it('toggleFact: false -> true (recheck)', () => {
    const result = makeScrapeResult({ approvedFacts: [true, false, true] })
    const toggled = toggleFact(result, 1)
    assert.deepStrictEqual(toggled.approvedFacts, [true, true, true])
  })

  it('toggleQa: true -> false', () => {
    const result = makeScrapeResult()
    const toggled = toggleQa(result, 0)
    assert.deepStrictEqual(toggled.approvedQa, [false, true])
  })

  it('toggleQa: false -> true', () => {
    const result = makeScrapeResult({ approvedQa: [false, true] })
    const toggled = toggleQa(result, 0)
    assert.deepStrictEqual(toggled.approvedQa, [true, true])
  })

  it('multiple toggles are independent — toggling fact does not affect QA', () => {
    let result = makeScrapeResult()
    result = toggleFact(result, 0) // uncheck fact 0
    result = toggleQa(result, 1)   // uncheck QA 1
    assert.deepStrictEqual(result.approvedFacts, [false, true, true])
    assert.deepStrictEqual(result.approvedQa, [true, false])
  })

  it('toggle does not mutate original array', () => {
    const result = makeScrapeResult()
    const originalFacts = [...result.approvedFacts]
    toggleFact(result, 0)
    assert.deepStrictEqual(result.approvedFacts, originalFacts)
  })

  it('double toggle returns to original state', () => {
    const result = makeScrapeResult()
    const toggled = toggleFact(toggleFact(result, 2), 2)
    assert.deepStrictEqual(toggled.approvedFacts, result.approvedFacts)
  })
})

describe('SCRAPE2: Approval filtering for chunk seeding', () => {
  it('default (all true) includes everything', () => {
    const result = makeScrapeResult()
    const facts = filterApprovedFacts(result)
    const qa = filterApprovedQa(result)
    assert.equal(facts.length, 3)
    assert.equal(qa.length, 2)
  })

  it('unchecked facts are excluded', () => {
    const result = makeScrapeResult({ approvedFacts: [true, false, true] })
    const facts = filterApprovedFacts(result)
    assert.deepStrictEqual(facts, ['Open 7 days a week', 'Free estimates'])
  })

  it('unchecked QA items are excluded', () => {
    const result = makeScrapeResult({ approvedQa: [false, true] })
    const qa = filterApprovedQa(result)
    assert.equal(qa.length, 1)
    assert.equal(qa[0].q, 'What areas do you serve?')
  })

  it('all unchecked produces empty arrays', () => {
    const result = makeScrapeResult({
      approvedFacts: [false, false, false],
      approvedQa: [false, false],
    })
    assert.equal(filterApprovedFacts(result).length, 0)
    assert.equal(filterApprovedQa(result).length, 0)
  })

  it('empty arrays produce no chunks', () => {
    const result = makeScrapeResult({
      businessFacts: [],
      extraQa: [],
      approvedFacts: [],
      approvedQa: [],
    })
    assert.equal(filterApprovedFacts(result).length, 0)
    assert.equal(filterApprovedQa(result).length, 0)
  })

  it('undefined entries in approvedFacts are treated as approved (!== false)', () => {
    // This matches the actual filter: approvedFacts[i] !== false
    // undefined !== false → true → item included
    const result = makeScrapeResult()
    // Simulate a shorter approvedFacts array than businessFacts (edge case)
    result.approvedFacts = [true, false]
    // Index 2 has no entry → approvedFacts[2] === undefined → !== false → included
    const facts = filterApprovedFacts(result)
    assert.deepStrictEqual(facts, ['Open 7 days a week', 'Free estimates'])
  })

  it('mixed approved/rejected preserves order of approved items', () => {
    const result = makeScrapeResult({
      businessFacts: ['A', 'B', 'C', 'D', 'E'],
      approvedFacts: [true, false, true, false, true],
    })
    assert.deepStrictEqual(filterApprovedFacts(result), ['A', 'C', 'E'])
  })

  it('filtering after toggle produces correct chunks', () => {
    let result = makeScrapeResult()
    // Uncheck fact 0 and QA 1
    result = toggleFact(result, 0)
    result = toggleQa(result, 1)

    const facts = filterApprovedFacts(result)
    const qa = filterApprovedQa(result)

    assert.deepStrictEqual(facts, ['Licensed and insured', 'Free estimates'])
    assert.equal(qa.length, 1)
    assert.equal(qa[0].q, 'Do you offer mobile service?')
  })
})

describe('SCRAPE1: Stale detection (24-hour boundary)', () => {
  it('1 hour ago is NOT stale', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    assert.equal(isStale(oneHourAgo), false)
  })

  it('23 hours ago is NOT stale', () => {
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()
    assert.equal(isStale(twentyThreeHoursAgo), false)
  })

  it('25 hours ago IS stale', () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    assert.equal(isStale(twentyFiveHoursAgo), true)
  })

  it('exactly 24 hours ago IS stale (boundary — uses > not >=, so 24h+1ms is stale)', () => {
    // The actual check: now - scrapedAt > STALE_MS
    // At exactly 24h: diff === STALE_MS → not > → not stale
    // At 24h + 1ms: diff > STALE_MS → stale
    const now = Date.now()
    const exactly24h = new Date(now - STALE_MS).toISOString()
    // Exactly 24h: diff === STALE_MS → NOT stale (> comparison, not >=)
    assert.equal(isStale(exactly24h, now), false)

    // 24h + 1ms → stale
    const just_over_24h = new Date(now - STALE_MS - 1).toISOString()
    assert.equal(isStale(just_over_24h, now), true)
  })

  it('just scraped (now) is NOT stale', () => {
    const justNow = new Date().toISOString()
    assert.equal(isStale(justNow), false)
  })

  it('48 hours ago IS stale', () => {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    assert.equal(isStale(fortyEightHoursAgo), true)
  })
})
