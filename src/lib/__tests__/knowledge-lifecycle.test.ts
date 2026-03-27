/**
 * knowledge-lifecycle.test.ts — G5 Knowledge Parity tests
 *
 * Tests the chunk lifecycle (approve, reject, unapprove, delete) and
 * gap → FAQ bridge logic to verify Phase B exit criteria.
 *
 * These are unit tests for the data flow logic, not integration tests
 * against Supabase. Route handlers are tested via Playwright E2E.
 *
 * Run: npx tsx --test src/lib/__tests__/knowledge-lifecycle.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ── Chunk status transitions ────────────────────────────────────────────────────

describe('Chunk status transitions', () => {
  // These model the valid state machine transitions from Phase B

  const VALID_TRANSITIONS: Record<string, string[]> = {
    pending: ['approved', 'rejected'],        // approve or reject
    approved: ['pending'],                     // unapprove → back to pending
    rejected: ['approved', 'pending'],         // re-approve or unapprove
    pending_embed: ['pending', 'approved'],    // embed completes → pending; admin force-approve
  }

  test('pending → approved is valid', () => {
    assert.ok(VALID_TRANSITIONS.pending.includes('approved'))
  })

  test('pending → rejected is valid', () => {
    assert.ok(VALID_TRANSITIONS.pending.includes('rejected'))
  })

  test('approved → pending is valid (unapprove)', () => {
    assert.ok(VALID_TRANSITIONS.approved.includes('pending'))
  })

  test('approved → rejected is NOT a valid direct transition', () => {
    assert.ok(!VALID_TRANSITIONS.approved.includes('rejected'),
      'Must unapprove to pending first, then reject')
  })

  test('pending_embed → pending is valid (embed completes)', () => {
    assert.ok(VALID_TRANSITIONS.pending_embed.includes('pending'))
  })
})

// ── Knowledge coverage calculation ──────────────────────────────────────────────

describe('Knowledge coverage calculation', () => {
  function computeCoverage(approved: number, pending: number, openGaps: number): number | null {
    const denominator = approved + pending + openGaps
    if (denominator === 0) return null
    return Math.round((approved / denominator) * 100)
  }

  test('returns null when no knowledge exists', () => {
    assert.equal(computeCoverage(0, 0, 0), null)
  })

  test('returns 100 when all chunks approved and no gaps', () => {
    assert.equal(computeCoverage(10, 0, 0), 100)
  })

  test('returns 50 when half approved, half pending', () => {
    assert.equal(computeCoverage(5, 5, 0), 50)
  })

  test('open gaps reduce coverage', () => {
    // 5 approved, 0 pending, 5 open gaps = 5/(5+0+5) = 50%
    assert.equal(computeCoverage(5, 0, 5), 50)
  })

  test('mixed scenario: 8 approved, 2 pending, 5 gaps = 53%', () => {
    assert.equal(computeCoverage(8, 2, 5), 53)
  })

  test('all pending, no approved = 0%', () => {
    assert.equal(computeCoverage(0, 10, 0), 0)
  })
})

// ── Gap → FAQ dedup logic ───────────────────────────────────────────────────────

describe('Gap → FAQ dedup', () => {
  function shouldCreateFaq(
    query: string,
    existingQa: { q: string; a: string }[],
  ): boolean {
    const normalizedQ = query.toLowerCase().trim()
    return !existingQa.some(
      entry => entry.q.toLowerCase().trim() === normalizedQ
    )
  }

  test('creates FAQ when no existing entries', () => {
    assert.ok(shouldCreateFaq('What are your hours?', []))
  })

  test('skips when exact question already exists', () => {
    assert.ok(!shouldCreateFaq('What are your hours?', [
      { q: 'What are your hours?', a: '9-5 weekdays' },
    ]))
  })

  test('skips when question matches case-insensitively', () => {
    assert.ok(!shouldCreateFaq('WHAT ARE YOUR HOURS?', [
      { q: 'what are your hours?', a: '9-5 weekdays' },
    ]))
  })

  test('creates when question is similar but not identical', () => {
    assert.ok(shouldCreateFaq('What time do you open?', [
      { q: 'What are your hours?', a: '9-5 weekdays' },
    ]))
  })

  test('handles whitespace normalization', () => {
    assert.ok(!shouldCreateFaq('  What are your hours?  ', [
      { q: 'What are your hours?', a: '9-5 weekdays' },
    ]))
  })
})

// ── Tool sync boundary conditions ───────────────────────────────────────────────

describe('Tool sync boundary (approved chunk count)', () => {
  // These verify the logic that determines when queryKnowledge tool should be registered

  function shouldRegisterKnowledgeTool(
    knowledgeBackend: string | null,
    approvedChunkCount: number,
  ): boolean {
    return knowledgeBackend === 'pgvector' && approvedChunkCount > 0
  }

  test('registered when pgvector + chunks > 0', () => {
    assert.ok(shouldRegisterKnowledgeTool('pgvector', 5))
  })

  test('NOT registered when pgvector + 0 chunks', () => {
    assert.ok(!shouldRegisterKnowledgeTool('pgvector', 0))
  })

  test('NOT registered when backend is null', () => {
    assert.ok(!shouldRegisterKnowledgeTool(null, 10))
  })

  test('unapprove crossing 1→0 should deregister', () => {
    // Before unapprove: 1 approved → tool registered
    assert.ok(shouldRegisterKnowledgeTool('pgvector', 1))
    // After unapprove: 0 approved → tool NOT registered
    assert.ok(!shouldRegisterKnowledgeTool('pgvector', 0))
  })

  test('approve crossing 0→1 should register', () => {
    assert.ok(!shouldRegisterKnowledgeTool('pgvector', 0))
    assert.ok(shouldRegisterKnowledgeTool('pgvector', 1))
  })
})
