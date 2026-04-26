/**
 * seed-knowledge-cleanup.test.ts — SCRAPE7 + K2
 *
 * Static analysis test: verifies that ALL code paths that create website_scrape
 * chunks use the shared seedKnowledgeFromScrape utility (which handles SCRAPE7
 * cleanup + serviceTags + embeddings + syncClientTools).
 *
 * Catches: stale chunk accumulation, serviceTags being silently dropped,
 * code drift between seeding paths.
 *
 * Run: npx tsx --test src/lib/__tests__/seed-knowledge-cleanup.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')

// ── Tests ───────────────────────────────────────────────────────────────────

describe('SCRAPE7: stale website_scrape chunk cleanup', () => {
  test('seed-knowledge.ts: deleteClientChunks(website_scrape) called BEFORE embedding', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, 'src/lib/seed-knowledge.ts'), 'utf-8')
    // Allow optional 3rd arg (sourceUrl) added for per-URL multi-URL approve scoping.
    const deleteMatch = /deleteClientChunks\([^)]*,\s*'website_scrape'(?:\s*,\s*[^)]+)?\)/.exec(src)
    const embedMatch = /embedChunks\(/.exec(src)
    assert.ok(deleteMatch, 'seed-knowledge.ts must call deleteClientChunks with website_scrape')
    assert.ok(embedMatch, 'seed-knowledge.ts must call embedChunks')
    assert.ok(deleteMatch.index < embedMatch.index, 'deleteClientChunks must appear BEFORE embedChunks')
  })

  test('backfill-knowledge/route.ts: deleteClientChunks(website_scrape) called BEFORE embedding', () => {
    const src = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/app/api/admin/backfill-knowledge/route.ts'), 'utf-8',
    )
    const deleteMatch = /deleteClientChunks\(.+,\s*'website_scrape'\)/.exec(src)
    const embedMatch = /embedChunks\(/.exec(src)
    assert.ok(deleteMatch, 'backfill-knowledge must call deleteClientChunks with website_scrape')
    assert.ok(embedMatch, 'backfill-knowledge must call embedChunks')
    assert.ok(deleteMatch.index < embedMatch.index, 'deleteClientChunks must appear BEFORE embedChunks')
  })

  test('seed-knowledge.ts imports deleteClientChunks', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, 'src/lib/seed-knowledge.ts'), 'utf-8')
    assert.ok(
      /import\s+\{[^}]*deleteClientChunks[^}]*\}\s+from/.test(src),
      'seed-knowledge.ts must import deleteClientChunks',
    )
  })
})

describe('K2: approve-website-knowledge uses shared seedKnowledgeFromScrape', () => {
  const approveRoutePath = 'src/app/api/dashboard/approve-website-knowledge/route.ts'

  test('imports seedKnowledgeFromScrape (not inline embedding)', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, approveRoutePath), 'utf-8')
    assert.ok(
      /import\s+\{[^}]*seedKnowledgeFromScrape[^}]*\}\s+from/.test(src),
      'approve route must import seedKnowledgeFromScrape',
    )
  })

  test('calls seedKnowledgeFromScrape with approvedPackage', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, approveRoutePath), 'utf-8')
    assert.ok(
      /seedKnowledgeFromScrape\(/.test(src),
      'approve route must call seedKnowledgeFromScrape',
    )
    assert.ok(
      /approvedPackage/.test(src),
      'approve route must pass approvedPackage param',
    )
  })

  test('does NOT have inline embedText calls (no code drift)', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, approveRoutePath), 'utf-8')
    assert.ok(
      !/embedText\(/.test(src),
      'approve route must NOT call embedText directly — use seedKnowledgeFromScrape instead',
    )
  })

  test('does NOT directly import embedText or deleteClientChunks', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, approveRoutePath), 'utf-8')
    assert.ok(
      !/import\s+\{[^}]*embedText[^}]*\}\s+from/.test(src),
      'approve route must NOT import embedText — it uses the shared utility',
    )
    assert.ok(
      !/import\s+\{[^}]*deleteClientChunks[^}]*\}\s+from/.test(src),
      'approve route must NOT import deleteClientChunks — shared utility handles it',
    )
  })

  test('passes chunkStatus and trustTier to seedKnowledgeFromScrape', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, approveRoutePath), 'utf-8')
    assert.ok(/chunkStatus/.test(src), 'approve route must pass chunkStatus')
    assert.ok(/trustTier/.test(src), 'approve route must pass trustTier')
  })
})

describe('K2: seedKnowledgeFromScrape supports approvedPackage + status', () => {
  test('SeedKnowledgeParams has approvedPackage field', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, 'src/lib/seed-knowledge.ts'), 'utf-8')
    assert.ok(/approvedPackage\??:/.test(src), 'SeedKnowledgeParams must have approvedPackage field')
  })

  test('SeedKnowledgeParams has chunkStatus field', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, 'src/lib/seed-knowledge.ts'), 'utf-8')
    assert.ok(/chunkStatus\??:/.test(src), 'SeedKnowledgeParams must have chunkStatus field')
  })

  test('SeedKnowledgeParams has trustTier field', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, 'src/lib/seed-knowledge.ts'), 'utf-8')
    assert.ok(/trustTier\??:/.test(src), 'SeedKnowledgeParams must have trustTier field')
  })

  test('ChunkInput supports status and trustTier', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, 'src/lib/embeddings.ts'), 'utf-8')
    assert.ok(/status\?: string/.test(src), 'ChunkInput must have optional status field')
    assert.ok(/trustTier\?: string/.test(src), 'ChunkInput must have optional trustTier field')
  })

  test('embedChunks passes status and trust_tier to upsert when present', () => {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, 'src/lib/embeddings.ts'), 'utf-8')
    assert.ok(/chunk\.status/.test(src), 'embedChunks must reference chunk.status')
    assert.ok(/chunk\.trustTier/.test(src), 'embedChunks must reference chunk.trustTier')
    assert.ok(/trust_tier/.test(src), 'embedChunks must map trustTier to trust_tier column')
  })
})

describe('K2: no seeding path bypasses the shared utility', () => {
  test('no route has inline website_scrape chunk creation without shared utility', () => {
    const routeFiles = [
      'src/app/api/dashboard/approve-website-knowledge/route.ts',
      'src/app/api/stripe/create-public-checkout/route.ts',
      'src/app/api/provision/trial/route.ts',
    ]

    for (const relPath of routeFiles) {
      const src = fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf-8')
      // Routes should NOT have inline .from('knowledge_chunks').upsert — that's the shared utility's job
      const hasInlineUpsert = /\.from\('knowledge_chunks'\)\s*\.\s*upsert/.test(src)
      assert.ok(
        !hasInlineUpsert,
        `${relPath} has inline knowledge_chunks upsert — should use seedKnowledgeFromScrape instead`,
      )
    }
  })
})
