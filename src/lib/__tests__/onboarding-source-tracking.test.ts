/**
 * onboarding-source-tracking.test.ts
 *
 * Static-analysis regression test for the onboarding → client_website_sources
 * write path. Both trial provisioning and Stripe checkout must record the
 * website URL as a tracked source after the initial scrape, otherwise the
 * dashboard's multi-URL knowledge list shows zero sources for newly onboarded
 * clients (chunks exist in knowledge_chunks but the source row does not).
 *
 * Background: shipped 2026-04-25 after Brian (calgary-property-leasing) was
 * onboarded with a homepage URL but his client_website_sources row had to be
 * backfilled by hand. The orphan row would silently happen for every new
 * Brian unless this write is wired into both onboarding paths.
 *
 * Run: npx tsx --test src/lib/__tests__/onboarding-source-tracking.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')

const TRIAL_ROUTE = 'src/app/api/provision/trial/route.ts'
const CHECKOUT_ROUTE = 'src/app/api/stripe/create-public-checkout/route.ts'
const SEED_HELPER = 'src/lib/seed-knowledge.ts'

describe('upsertOnboardingWebsiteSource helper', () => {
  test('seed-knowledge.ts exports upsertOnboardingWebsiteSource', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, SEED_HELPER), 'utf-8')
    assert.ok(
      /export\s+async\s+function\s+upsertOnboardingWebsiteSource\s*\(/.test(src),
      'seed-knowledge.ts must export upsertOnboardingWebsiteSource',
    )
  })

  test('helper upserts on (client_id, url) — matches dashboard scrape-website route', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, SEED_HELPER), 'utf-8')
    // Slice from the function declaration to the next top-level `export` (or EOF).
    const declIdx = src.search(/export\s+async\s+function\s+upsertOnboardingWebsiteSource\s*\(/)
    assert.ok(declIdx > -1, 'function declaration must be findable')
    const after = src.slice(declIdx)
    const nextExportIdx = after.slice(50).search(/\nexport\s+/)
    const helperBody = nextExportIdx > -1 ? after.slice(0, 50 + nextExportIdx) : after
    assert.ok(
      /\.from\(\s*['"]client_website_sources['"]\s*\)/.test(helperBody),
      'helper must write to client_website_sources table',
    )
    assert.ok(
      /onConflict:\s*['"]client_id,url['"]/.test(helperBody),
      'helper must use onConflict: client_id,url to match dashboard scrape-website pattern',
    )
  })
})

describe('trial provisioning records website source', () => {
  test('trial route imports upsertOnboardingWebsiteSource', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, TRIAL_ROUTE), 'utf-8')
    assert.ok(
      /import\s+\{[^}]*upsertOnboardingWebsiteSource[^}]*\}\s+from\s+['"]@\/lib\/seed-knowledge['"]/.test(src),
      'provision/trial must import upsertOnboardingWebsiteSource from @/lib/seed-knowledge',
    )
  })

  test('trial route calls upsertOnboardingWebsiteSource', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, TRIAL_ROUTE), 'utf-8')
    assert.ok(
      /upsertOnboardingWebsiteSource\s*\(/.test(src),
      'provision/trial must call upsertOnboardingWebsiteSource',
    )
  })

  test('trial route call sits AFTER seedKnowledgeFromScrape (so chunkCount is known)', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, TRIAL_ROUTE), 'utf-8')
    const seedIdx = src.indexOf('seedKnowledgeFromScrape(')
    const upsertIdx = src.indexOf('upsertOnboardingWebsiteSource(')
    assert.ok(seedIdx > -1 && upsertIdx > -1, 'both calls must exist')
    assert.ok(
      seedIdx < upsertIdx,
      'upsertOnboardingWebsiteSource must run AFTER seedKnowledgeFromScrape so chunkCount is captured',
    )
  })

  test('trial route passes sourceUrl to seedKnowledgeFromScrape (so chunks have URL attribution)', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, TRIAL_ROUTE), 'utf-8')
    // Slice from `seedKnowledgeFromScrape(` to the matching close-paren of the
    // outer call. Brute force: take the next 800 chars after the call site
    // (call body is ~400 chars including option spread blocks).
    const seedIdx = src.indexOf('seedKnowledgeFromScrape(')
    assert.ok(seedIdx > -1, 'seedKnowledgeFromScrape call site must exist')
    const window = src.slice(seedIdx, seedIdx + 800)
    assert.ok(
      /sourceUrl/.test(window),
      'trial route must pass sourceUrl so per-URL chunk cleanup works when source row is deleted',
    )
  })
})

describe('Stripe checkout records website source', () => {
  test('checkout route imports upsertOnboardingWebsiteSource', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, CHECKOUT_ROUTE), 'utf-8')
    assert.ok(
      /import\s+\{[^}]*upsertOnboardingWebsiteSource[^}]*\}\s+from\s+['"]@\/lib\/seed-knowledge['"]/.test(src),
      'create-public-checkout must import upsertOnboardingWebsiteSource from @/lib/seed-knowledge',
    )
  })

  test('checkout route calls upsertOnboardingWebsiteSource', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, CHECKOUT_ROUTE), 'utf-8')
    assert.ok(
      /upsertOnboardingWebsiteSource\s*\(/.test(src),
      'create-public-checkout must call upsertOnboardingWebsiteSource',
    )
  })

  test('checkout route call sits AFTER seedKnowledgeFromScrape', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, CHECKOUT_ROUTE), 'utf-8')
    const seedIdx = src.indexOf('seedKnowledgeFromScrape(')
    const upsertIdx = src.indexOf('upsertOnboardingWebsiteSource(')
    assert.ok(seedIdx > -1 && upsertIdx > -1, 'both calls must exist')
    assert.ok(
      seedIdx < upsertIdx,
      'upsertOnboardingWebsiteSource must run AFTER seedKnowledgeFromScrape so chunkCount is captured',
    )
  })

  test('checkout route passes sourceUrl to seedKnowledgeFromScrape', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, CHECKOUT_ROUTE), 'utf-8')
    const seedIdx = src.indexOf('seedKnowledgeFromScrape(')
    assert.ok(seedIdx > -1, 'seedKnowledgeFromScrape call site must exist')
    const window = src.slice(seedIdx, seedIdx + 800)
    assert.ok(
      /sourceUrl/.test(window),
      'checkout route must pass sourceUrl so per-URL chunk cleanup works when source row is deleted',
    )
  })
})

describe('parity: trial and checkout treat status the same way', () => {
  test('both routes write status=approved when user reviewed scrape preview during onboarding', () => {
    const trial = fs.readFileSync(path.join(PROJECT_ROOT, TRIAL_ROUTE), 'utf-8')
    const checkout = fs.readFileSync(path.join(PROJECT_ROOT, CHECKOUT_ROUTE), 'utf-8')
    assert.ok(
      /status:\s*sourceStatus/.test(trial) && /'approved'\s+as\s+const/.test(trial),
      'trial route must derive sourceStatus="approved" when websiteScrapeResult is present',
    )
    assert.ok(
      /status:\s*sourceStatus/.test(checkout) && /'approved'\s+as\s+const/.test(checkout),
      'checkout route must derive sourceStatus="approved" when scrapePreview is present',
    )
  })

  test('both routes write status=extracted when only fresh raw scrape ran', () => {
    const trial = fs.readFileSync(path.join(PROJECT_ROOT, TRIAL_ROUTE), 'utf-8')
    const checkout = fs.readFileSync(path.join(PROJECT_ROOT, CHECKOUT_ROUTE), 'utf-8')
    assert.ok(/'extracted'\s+as\s+const/.test(trial), 'trial route must support status=extracted')
    assert.ok(/'extracted'\s+as\s+const/.test(checkout), 'checkout route must support status=extracted')
  })
})
