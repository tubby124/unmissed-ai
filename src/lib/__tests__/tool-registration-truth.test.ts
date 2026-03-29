/**
 * tool-registration-truth.test.ts — S8c
 *
 * Verifies that buildAgentTools correctly gates knowledge tool registration
 * based on approved chunk count, and that tool composition is correct for
 * all flag combinations.
 *
 * Catches the stale-knowledge-tool class of bugs where queryKnowledge is
 * registered on an agent with 0 approved chunks.
 *
 * Run: npx tsx --test src/lib/__tests__/tool-registration-truth.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildAgentTools } from '../ultravox.js'

// Helper: extract tool name from each tool in the array
// Handles both built-in tools ({ toolName }) and temporary tools ({ temporaryTool.modelToolName })
function toolNames(tools: object[]): string[] {
  return tools.map(t => {
    const obj = t as Record<string, any>
    // Built-in tool reference (e.g. hangUp)
    if (obj.toolName) return obj.toolName
    // Temporary tool (e.g. calendar, SMS, transfer, knowledge, coaching)
    const tt = obj.temporaryTool
    return tt?.modelToolName ?? 'unknown'
  })
}

// ── S8c: Knowledge tool gating ──────────────────────────────────────────────

describe('S8c: Knowledge tool gating — buildAgentTools', () => {
  test('knowledge_chunk_count=0 → NO queryKnowledge tool', () => {
    const tools = buildAgentTools({
      slug: 'test-client',
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 0,
    })
    const names = toolNames(tools)
    assert.ok(!names.includes('queryKnowledge'),
      `queryKnowledge must NOT be registered when chunk count is 0, got: ${names.join(', ')}`)
  })

  test('knowledge_chunk_count=undefined → NO queryKnowledge tool (safe default)', () => {
    const tools = buildAgentTools({
      slug: 'test-client',
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: undefined,
    })
    const names = toolNames(tools)
    assert.ok(!names.includes('queryKnowledge'),
      `queryKnowledge must NOT be registered when chunk count is undefined, got: ${names.join(', ')}`)
  })

  test('knowledge_backend=undefined → NO queryKnowledge regardless of count', () => {
    const tools = buildAgentTools({
      slug: 'test-client',
      knowledge_backend: undefined,
      knowledge_chunk_count: 10,
    })
    const names = toolNames(tools)
    assert.ok(!names.includes('queryKnowledge'),
      `queryKnowledge must NOT be registered without pgvector backend, got: ${names.join(', ')}`)
  })

  test('knowledge_backend="pgvector" + chunk_count=5 → queryKnowledge IS registered', () => {
    const tools = buildAgentTools({
      slug: 'test-client',
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 5,
    })
    const names = toolNames(tools)
    assert.ok(names.includes('queryKnowledge'),
      `queryKnowledge must be registered when pgvector + 5 approved chunks, got: ${names.join(', ')}`)
  })

  test('knowledge_backend="pgvector" + chunk_count=1 → queryKnowledge IS registered (boundary)', () => {
    const tools = buildAgentTools({
      slug: 'test-client',
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 1,
    })
    const names = toolNames(tools)
    assert.ok(names.includes('queryKnowledge'),
      `queryKnowledge must be registered at boundary count=1, got: ${names.join(', ')}`)
  })

  test('no slug → NO queryKnowledge even with pgvector + chunks', () => {
    const tools = buildAgentTools({
      knowledge_backend: 'pgvector',
      knowledge_chunk_count: 5,
    })
    const names = toolNames(tools)
    assert.ok(!names.includes('queryKnowledge'),
      `queryKnowledge must NOT be registered without slug, got: ${names.join(', ')}`)
  })
})

// ── Tool composition truth ──────────────────────────────────────────────────

describe('Tool composition: all flags ON', () => {
  const tools = buildAgentTools({
    slug: 'full-client',
    booking_enabled: true,
    forwarding_number: '+15551234567',
    sms_enabled: true,
    twilio_number: '+15551234567',
    knowledge_backend: 'pgvector',
    knowledge_chunk_count: 10,
    transfer_conditions: 'caller asks for manager',
  })
  const names = toolNames(tools)

  test('includes hangUp (base tool)', () => {
    assert.ok(names.includes('hangUp'), `must include hangUp, got: ${names.join(', ')}`)
  })

  test('includes calendar tools', () => {
    assert.ok(names.includes('checkCalendarAvailability'), 'must include checkCalendarAvailability')
    assert.ok(names.includes('bookAppointment'), 'must include bookAppointment')
  })

  test('includes transferCall', () => {
    assert.ok(names.includes('transferCall'), 'must include transferCall')
  })

  test('includes sendTextMessage', () => {
    assert.ok(names.includes('sendTextMessage'), 'must include sendTextMessage')
  })

  test('includes queryKnowledge', () => {
    assert.ok(names.includes('queryKnowledge'), 'must include queryKnowledge')
  })

  test('includes checkForCoaching', () => {
    assert.ok(names.includes('checkForCoaching'), 'must include checkForCoaching')
  })

  test('total tool count = 8 (hangUp + 3 calendar + transfer + sms + knowledge + coaching)', () => {
    assert.equal(tools.length, 8, `expected 8 tools, got ${tools.length}: ${names.join(', ')}`)
  })
})

describe('Tool composition: minimal flags (slug only)', () => {
  const tools = buildAgentTools({ slug: 'minimal-client' })
  const names = toolNames(tools)

  test('includes hangUp + coaching only', () => {
    assert.equal(tools.length, 2, `expected 2 tools (hangUp + coaching), got ${tools.length}: ${names.join(', ')}`)
    assert.ok(names.includes('hangUp'), 'must include hangUp')
    assert.ok(names.includes('checkForCoaching'), 'must include checkForCoaching')
  })

  test('does NOT include optional tools', () => {
    assert.ok(!names.includes('checkCalendarAvailability'), 'no calendar')
    assert.ok(!names.includes('bookAppointment'), 'no booking')
    assert.ok(!names.includes('transferCall'), 'no transfer')
    assert.ok(!names.includes('sendTextMessage'), 'no SMS')
    assert.ok(!names.includes('queryKnowledge'), 'no knowledge')
  })
})

describe('Tool composition: no slug → hangUp only', () => {
  const tools = buildAgentTools({})
  const names = toolNames(tools)

  test('only hangUp when no slug', () => {
    assert.equal(tools.length, 1, `expected 1 tool (hangUp), got ${tools.length}: ${names.join(', ')}`)
    assert.ok(names.includes('hangUp'), 'must include hangUp')
  })
})

// ── Flag isolation: each flag controls exactly its tools ─────────────────────

describe('Flag isolation: booking_enabled only', () => {
  const tools = buildAgentTools({ slug: 'test', booking_enabled: true })
  const names = toolNames(tools)

  test('adds calendar tools but not transfer/sms/knowledge', () => {
    assert.ok(names.includes('checkCalendarAvailability'))
    assert.ok(names.includes('bookAppointment'))
    assert.ok(!names.includes('transferCall'))
    assert.ok(!names.includes('sendTextMessage'))
    assert.ok(!names.includes('queryKnowledge'))
  })
})

describe('Flag isolation: sms_enabled without twilio_number (trial client pattern)', () => {
  // Trial clients have sms_enabled=true but no twilio_number — SMS tool must NOT be injected
  const tools = buildAgentTools({ slug: 'test', sms_enabled: true })
  const names = toolNames(tools)

  test('does NOT add SMS tool without twilio_number', () => {
    assert.ok(!names.includes('sendTextMessage'),
      `sendTextMessage must NOT appear without twilio_number, got: ${names.join(', ')}`)
  })
})

describe('Flag isolation: sms_enabled + twilio_number', () => {
  const tools = buildAgentTools({ slug: 'test', sms_enabled: true, twilio_number: '+15551234567' })
  const names = toolNames(tools)

  test('adds SMS tool but not calendar/transfer/knowledge', () => {
    assert.ok(names.includes('sendTextMessage'))
    assert.ok(!names.includes('checkCalendarAvailability'))
    assert.ok(!names.includes('bookAppointment'))
    assert.ok(!names.includes('transferCall'))
    assert.ok(!names.includes('queryKnowledge'))
  })
})

describe('Flag isolation: forwarding_number only', () => {
  const tools = buildAgentTools({ slug: 'test', forwarding_number: '+15551234567' })
  const names = toolNames(tools)

  test('adds transfer tool but not calendar/sms/knowledge', () => {
    assert.ok(names.includes('transferCall'))
    assert.ok(!names.includes('checkCalendarAvailability'))
    assert.ok(!names.includes('bookAppointment'))
    assert.ok(!names.includes('sendTextMessage'))
    assert.ok(!names.includes('queryKnowledge'))
  })
})
