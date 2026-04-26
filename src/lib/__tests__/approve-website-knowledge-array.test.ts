/**
 * approve-website-knowledge-array.test.ts
 *
 * Static-analysis regression test for the `clients.business_facts` array contract
 * in [src/app/api/dashboard/approve-website-knowledge/route.ts].
 *
 * Background: the route was treating `business_facts` as a string (split/join on
 * \n) and writing a string to a `text[]` column. For clients with non-empty
 * `business_facts` (e.g. Brian / calgary-property-leasing after his 2026-04-25
 * backfill), this returned a Postgres array-type-mismatch 500 and surfaced as
 * "Failed to save approved knowledge" toast in the dashboard scrape approve
 * flow. Schema is `business_facts: string[] | null`
 * (src/lib/database.types.ts).
 *
 * Run: npx tsx --test src/lib/__tests__/approve-website-knowledge-array.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')
const ROUTE = 'src/app/api/dashboard/approve-website-knowledge/route.ts'

describe('approve-website-knowledge: business_facts is treated as an array', () => {
  test('route does NOT call .split(\\n) on business_facts (string-mode bug)', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, ROUTE), 'utf-8')
    // Locate the business_facts handling block.
    const block = src.slice(
      src.indexOf('Also merge into business_facts'),
      src.indexOf('// ── Update client row'),
    )
    assert.ok(block.length > 0, 'business_facts merge block must be findable')
    // The buggy code did `existingFacts.split('\n')` after coercing to string.
    // After the fix, all merging happens on string[] arrays so the only `.split`
    // is the legacy-format coalesce on the *raw input*, not on `existingFacts`.
    assert.ok(
      !/existingFacts\.split\(/.test(block),
      'must not split existingFacts on \\n — it is a string[], not a string',
    )
    assert.ok(
      !/dedupedNewFacts\.join\(['"]\\n['"]\)/.test(block),
      'must not join dedupedNewFacts back into a single string before write',
    )
  })

  test('route writes business_facts as a string[] to clients.update', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, ROUTE), 'utf-8')
    // The merged value must be a string[] — typed explicitly.
    assert.ok(
      /const\s+mergedFacts[\s:]*string\[\]/.test(src),
      'mergedFacts must be typed as string[]',
    )
    // It must be built by spreading the existingFacts array (not joined into a string).
    const flat = src.replace(/\s+/g, ' ')
    assert.ok(
      /\[\s*\.\.\.existingFacts\s*,\s*\.\.\.dedupedNewFacts\s*\]/.test(flat),
      'mergedFacts must be built by spreading both arrays — not joining strings',
    )
  })

  test('route handles array, legacy string, and null shapes for client.business_facts', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, ROUTE), 'utf-8')
    const block = src.slice(
      src.indexOf('Also merge into business_facts'),
      src.indexOf('// ── Update client row'),
    )
    assert.ok(/Array\.isArray\([^)]*business_facts[^)]*\)|Array\.isArray\(rawFacts\)/.test(block),
      'must check Array.isArray for the array case (current schema)')
    assert.ok(/typeof\s+\w+\s*===\s*['"]string['"]/.test(block),
      'must handle legacy string case (older rows with newline-joined strings)')
  })
})

describe('approve-website-knowledge: client_website_sources sync after approve', () => {
  test('route updates client_website_sources row to approved + chunk_count after seed succeeds', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, ROUTE), 'utf-8')
    const flat = src.replace(/\s+/g, ' ')
    // Must touch the multi-URL source table after the seed call so the dashboard
    // list reflects the approved state — without this, rows stay at 'extracted'
    // even though chunks are live in knowledge_chunks (this caused 2026-04-26
    // "Ready to approve" stuck-state bug for Brian).
    assert.ok(
      /from\(['"]client_website_sources['"]\)\s*\.update\(\s*\{[^}]*scrape_status:\s*['"]approved['"]/.test(flat),
      'must update client_website_sources.scrape_status to approved',
    )
    assert.ok(
      /chunk_count:\s*seedResult\.stored/.test(flat),
      'must write seedResult.stored as chunk_count',
    )
  })

  test('route accepts sourceUrl in body and threads it through seedKnowledgeFromScrape', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, ROUTE), 'utf-8')
    // Body parsing must accept sourceUrl so multi-URL approve targets the right row.
    assert.ok(
      /sourceUrl\?:\s*string/.test(src),
      'route body type must declare optional sourceUrl: string',
    )
    // The resolved URL (body or fallback) must be passed to the seed util so per-URL
    // chunk delete and source row update line up.
    assert.ok(
      /sourceUrl:\s*effectiveSourceUrl/.test(src),
      'must pass effectiveSourceUrl into seedKnowledgeFromScrape',
    )
  })
})
