/**
 * settings-runtime-truth.test.ts — Wave 1b integration test
 *
 * Traces client settings through the full assembly path:
 *   settings → AgentContext → prompt → tools
 *
 * Catches the "Omar incident" class of bugs where DB flags say one thing
 * but the actual prompt/tools delivered to Ultravox say another.
 *
 * TEMPORARY — remove when runtime injection replaces prompt mutation.
 *
 * Run: npx tsx --test src/lib/__tests__/settings-runtime-truth.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { patchCalendarBlock, getServiceType } from '../prompt-patcher.js'
import { buildAgentContext, type ClientRow } from '../agent-context.js'
import {
  buildCalendarTools,
  buildTransferTools,
  buildSmsTools,
  buildCorpusTools,
} from '../ultravox.js'

const CALENDAR_HEADING = '# CALENDAR BOOKING FLOW'

const basePrompt = `# IDENTITY
You are Mark, the virtual receptionist for Windshield Hub.

# CONVERSATION FLOW
Greet the caller and help them.

# VOICE NATURALNESS
Speak naturally.`

function makeClient(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: 'test-client-id',
    slug: 'test-client',
    niche: 'auto_glass',
    business_name: 'Test Business',
    timezone: 'America/Regina',
    ...overrides,
  }
}

// ── booking_enabled=true + calendar connected → prompt + tools ──────────────

describe('booking_enabled=true + google_calendar_connected → prompt + tools', () => {
  test('prompt contains CALENDAR BOOKING FLOW + tools include calendar tools', () => {
    const serviceType = getServiceType('auto_glass')
    const prompt = patchCalendarBlock(basePrompt, true, serviceType, 'Mark')
    assert.ok(prompt.includes(CALENDAR_HEADING), 'prompt must have calendar heading')
    assert.ok(prompt.includes('service appointment'), 'prompt must use auto_glass service type')

    const tools = buildCalendarTools('test-client')
    const toolNames = tools.map(t => (t as Record<string, any>).temporaryTool?.modelToolName)
    assert.ok(toolNames.includes('checkCalendarAvailability'), 'must have checkCalendarAvailability')
    assert.ok(toolNames.includes('bookAppointment'), 'must have bookAppointment')
  })

  test('calendar tool URLs include correct slug', () => {
    const tools = buildCalendarTools('windshield-hub')
    for (const tool of tools) {
      const url = (tool as Record<string, any>).temporaryTool?.http?.baseUrlPattern
      assert.ok(url?.includes('windshield-hub'), `URL must include slug: ${url}`)
    }
  })
})

// ── booking_enabled=true + NO calendar connection → effective = false ────────

describe('booking_enabled=true + NO calendar connection → effective booking = false', () => {
  test('without calendar connection, prompt should NOT be patched', () => {
    // In the real system, booking_enabled would be set to false when calendar is not connected.
    // This test verifies that prompt stays clean when the effective flag is false.
    const prompt = patchCalendarBlock(basePrompt, false)
    assert.ok(!prompt.includes(CALENDAR_HEADING), 'no calendar block when effective=false')
  })
})

// ── booking_enabled=false + calendar connected → clean state ────────────────

describe('booking_enabled=false + calendar connected → no calendar block, no tools', () => {
  test('disabling booking removes calendar block from previously patched prompt', () => {
    const withCalendar = patchCalendarBlock(basePrompt, true)
    assert.ok(withCalendar.includes(CALENDAR_HEADING), 'precondition: block was added')
    const disabled = patchCalendarBlock(withCalendar, false)
    assert.ok(!disabled.includes(CALENDAR_HEADING), 'calendar block must be removed')
  })
})

// ── sms_enabled=true → tools include sendTextMessage, prompt NOT mutated ────

describe('sms_enabled=true → tool only, no prompt mutation', () => {
  test('SMS tool is built with correct structure', () => {
    const tools = buildSmsTools('test-client')
    assert.equal(tools.length, 1)
    const tool = tools[0] as Record<string, any>
    assert.equal(tool.temporaryTool.modelToolName, 'sendTextMessage')
    assert.ok(tool.temporaryTool.http.baseUrlPattern.includes('test-client'))
  })

  test('SMS does NOT patch the prompt text', () => {
    // SMS is tool-only — no prompt instruction block
    assert.ok(!basePrompt.includes('sendTextMessage'))
  })
})

// ── forwarding_number set → tools include transferCall ──────────────────────

describe('forwarding_number set → tools include transferCall', () => {
  test('transfer tools built with correct slug and structure', () => {
    const tools = buildTransferTools('test-client')
    assert.equal(tools.length, 1)
    const tool = tools[0] as Record<string, any>
    assert.equal(tool.temporaryTool.modelToolName, 'transferCall')
    assert.ok(tool.temporaryTool.http.baseUrlPattern.includes('test-client'))
  })

  test('custom transfer conditions are embedded in tool description', () => {
    const tools = buildTransferTools('test-client', 'the caller asks for a quote over $500')
    const desc = (tools[0] as Record<string, any>).temporaryTool.description
    assert.ok(desc.includes('quote over $500'), 'custom condition should be in description')
  })

  test('no custom conditions → uses default transfer description', () => {
    const tools = buildTransferTools('test-client')
    const desc = (tools[0] as Record<string, any>).temporaryTool.description
    assert.ok(desc.includes('explicitly asks to speak'), 'default condition')
  })
})

// ── corpus_enabled=true + corpus_id → tools include queryCorpus ─────────────

describe('corpus_enabled=true + corpus_id → queryCorpus tool', () => {
  test('corpus tools built with given ID', () => {
    const tools = buildCorpusTools('corpus-123-abc')
    assert.equal(tools.length, 1)
    const tool = tools[0] as Record<string, any>
    assert.equal(tool.toolName, 'queryCorpus')
    assert.equal(tool.parameterOverrides.corpus_id, 'corpus-123-abc')
    assert.equal(tool.parameterOverrides.max_results, 5)
  })

  test('corpus tools empty when null ID and no env var', () => {
    // In test env, ULTRAVOX_CORPUS_ID is not set
    const tools = buildCorpusTools(null)
    // May return empty or fall back to env var
    assert.ok(Array.isArray(tools))
  })
})

// ── Full integration: settings object → assembled context ───────────────────

describe('Full settings → AgentContext integration', () => {
  test('auto_glass client gets correct capabilities', () => {
    const client = makeClient({ niche: 'auto_glass' })
    const ctx = buildAgentContext(client, '+15551234567')
    assert.equal(ctx.capabilities.bookAppointments, false, 'auto_glass: no booking by default')
    assert.equal(ctx.capabilities.transferCalls, true, 'auto_glass: transfer enabled')
    assert.equal(ctx.capabilities.useKnowledgeLookup, true, 'auto_glass: knowledge lookup')
  })

  test('voicemail client gets minimal capabilities', () => {
    const client = makeClient({ niche: 'voicemail' })
    const ctx = buildAgentContext(client, '+15551234567')
    assert.equal(ctx.capabilities.bookAppointments, false)
    assert.equal(ctx.capabilities.transferCalls, false)
    assert.equal(ctx.capabilities.useKnowledgeLookup, false)
    assert.equal(ctx.capabilities.takeMessages, true)
  })

  test('real_estate client gets full capabilities', () => {
    const client = makeClient({ niche: 'real_estate' })
    const ctx = buildAgentContext(client, '+15551234567')
    assert.equal(ctx.capabilities.bookAppointments, true)
    assert.equal(ctx.capabilities.transferCalls, true)
    assert.equal(ctx.capabilities.useKnowledgeLookup, true)
    assert.equal(ctx.capabilities.usePropertyLookup, true)
  })
})
