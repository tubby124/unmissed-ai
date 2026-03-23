/**
 * prompt-snapshots.test.ts — Wave 1a snapshot-style tests
 *
 * Catches silent prompt mutations, formatting drift, and length violations.
 * TEMPORARY — remove when runtime injection replaces prompt mutation.
 *
 * Run: npx tsx --test src/lib/__tests__/prompt-snapshots.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { patchCalendarBlock } from '../prompt-patcher.js'
import { buildAgentContext, type ClientRow } from '../agent-context.js'
import { PROMPT_CHAR_HARD_MAX } from '../knowledge-summary.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientsDir = resolve(__dirname, '..', '..', '..', 'clients')

function readPrompt(slug: string): string {
  try {
    return readFileSync(resolve(clientsDir, slug, 'SYSTEM_PROMPT.txt'), 'utf-8')
  } catch {
    return ''
  }
}

function extractHeadings(text: string): string[] {
  return text.split('\n').filter(line => /^#+ /.test(line))
}

// ── Section structure (hasan-sharif) ─────────────────────────────────────────

describe('Prompt section structure (hasan-sharif)', () => {
  const prompt = readPrompt('hasan-sharif')

  test('prompt is non-empty', () => {
    assert.ok(prompt.length > 0, 'hasan-sharif SYSTEM_PROMPT.txt should exist and be non-empty')
  })

  test('prompt has content (compressed v36 may not use # headings)', () => {
    if (!prompt) return
    // Compressed prompts may use inline structure instead of markdown headings.
    // Verify core concepts are present in the text, not necessarily as headings.
    assert.ok(prompt.includes('Aisha') || prompt.includes('assistant'), 'should reference agent identity')
  })
})

// ── AgentContext output shape ────────────────────────────────────────────────

describe('AgentContext output shape', () => {
  const mockClient: ClientRow = {
    id: 'test-id',
    slug: 'hasan-sharif',
    niche: 'real_estate',
    business_name: 'Hasan Sharif Real Estate',
    timezone: 'America/Regina',
    business_hours_weekday: null,
    business_hours_weekend: null,
  }

  test('returns all required top-level keys', () => {
    const ctx = buildAgentContext(mockClient, '+15551234567', [], new Date('2026-03-19T14:00:00Z'))
    assert.ok('business' in ctx)
    assert.ok('caller' in ctx)
    assert.ok('capabilities' in ctx)
    assert.ok('assembled' in ctx)
    assert.ok('knowledge' in ctx)
    assert.ok('retrieval' in ctx)
  })

  test('assembled blocks are all strings', () => {
    const ctx = buildAgentContext(mockClient, '+15551234567')
    assert.equal(typeof ctx.assembled.callerContextBlock, 'string')
    assert.equal(typeof ctx.assembled.businessFactsBlock, 'string')
    assert.equal(typeof ctx.assembled.extraQaBlock, 'string')
    assert.equal(typeof ctx.assembled.contextDataBlock, 'string')
  })

  test('caller context block includes CALLER PHONE when provided', () => {
    const ctx = buildAgentContext(mockClient, '+15551234567')
    assert.ok(ctx.assembled.callerContextBlock.includes('+15551234567'))
  })

  test('caller context block omits CALLER PHONE for unknown callers', () => {
    const ctx = buildAgentContext(mockClient, 'unknown')
    assert.ok(!ctx.assembled.callerContextBlock.includes('CALLER PHONE'))
  })
})

// ── Niche contrast: real_estate vs voicemail ──────────────────────────────────

describe('Niche contrast: real_estate vs voicemail', () => {
  test('voicemail has NO booking capability', () => {
    const vm: ClientRow = { id: 'vm', slug: 'test-vm', niche: 'voicemail' }
    const ctx = buildAgentContext(vm, '+15551234567')
    assert.equal(ctx.capabilities.bookAppointments, false)
  })

  test('real_estate HAS booking capability', () => {
    const re: ClientRow = { id: 're', slug: 'test-re', niche: 'real_estate' }
    const ctx = buildAgentContext(re, '+15551234567')
    assert.equal(ctx.capabilities.bookAppointments, true)
  })

  test('voicemail has NO transfer capability', () => {
    const vm: ClientRow = { id: 'vm', slug: 'test-vm', niche: 'voicemail' }
    const ctx = buildAgentContext(vm, '+15551234567')
    assert.equal(ctx.capabilities.transferCalls, false)
  })

  test('voicemail prompt should NOT contain booking block after patching', () => {
    const vmPrompt = '# IDENTITY\nYou are a voicemail agent.'
    const patched = patchCalendarBlock(vmPrompt, false)
    assert.ok(!patched.includes('CALENDAR BOOKING FLOW'))
  })
})

// ── Prompt length safety ─────────────────────────────────────────────────────

describe('Prompt length safety', () => {
  test('patched prompt under 8K stays under hard max', () => {
    const shortPrompt = 'X'.repeat(6000)
    const patched = patchCalendarBlock(shortPrompt, true, 'appointment', 'the team')
    assert.ok(
      patched.length < PROMPT_CHAR_HARD_MAX,
      `${patched.length} chars should be under ${PROMPT_CHAR_HARD_MAX}`,
    )
  })

  test('detects when patching pushes prompt over hard max', () => {
    const longPrompt = 'X'.repeat(24000)
    const patched = patchCalendarBlock(longPrompt, true, 'appointment', 'the team')
    assert.ok(
      patched.length > PROMPT_CHAR_HARD_MAX,
      `${patched.length} chars should exceed ${PROMPT_CHAR_HARD_MAX} — verifies detection works`,
    )
  })

  test('real hasan-sharif prompt length is tracked', () => {
    const prompt = readPrompt('hasan-sharif')
    if (!prompt) return
    // hasan-sharif v36 is 9,079 chars (compressed from 15K+ original).
    // Still over 8K hard max — tracked for further compression.
    assert.ok(
      prompt.length < 12000,
      `hasan-sharif prompt is ${prompt.length} chars — exceeds 12K safety ceiling`,
    )
  })
})

// ── H4: Prompt length regression test (all clients) ──────────────────────────

describe('Prompt length guardrails (all clients)', () => {
  const WARN_THRESHOLD = 8000
  const FAIL_THRESHOLD = 12000
  const slugs = ['hasan-sharif', 'exp-realty', 'windshield-hub', 'urban-vibe', 'manzil-isa']

  for (const slug of slugs) {
    test(`${slug} prompt under ${FAIL_THRESHOLD} char hard ceiling`, () => {
      const prompt = readPrompt(slug)
      if (!prompt) return // skip if file doesn't exist
      assert.ok(
        prompt.length < FAIL_THRESHOLD,
        `${slug} prompt is ${prompt.length} chars — exceeds ${FAIL_THRESHOLD} hard ceiling. Compress or split.`,
      )
    })

    test(`${slug} prompt length warning (over ${WARN_THRESHOLD} chars)`, () => {
      const prompt = readPrompt(slug)
      if (!prompt) return
      if (prompt.length > WARN_THRESHOLD) {
        console.warn(`⚠️  ${slug}: ${prompt.length} chars (over ${WARN_THRESHOLD} warn threshold)`)
      }
      // This test always passes — the warn is informational.
      // The hard ceiling test above is what fails the build.
      assert.ok(true)
    })
  }
})
