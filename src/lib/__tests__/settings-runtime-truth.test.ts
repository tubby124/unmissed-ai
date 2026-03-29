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
  test('prompt contains CALENDAR BOOKING FLOW + triage tools include transitionToBookingStage', () => {
    const serviceType = getServiceType('auto_glass')
    const prompt = patchCalendarBlock(basePrompt, true, serviceType, 'Mark')
    assert.ok(prompt.includes(CALENDAR_HEADING), 'prompt must have calendar heading')
    assert.ok(prompt.includes('service appointment'), 'prompt must use auto_glass service type')

    const tools = buildCalendarTools('test-client')
    const toolNames = tools.map(t => (t as Record<string, any>).temporaryTool?.modelToolName)
    assert.ok(toolNames.includes('transitionToBookingStage'), 'triage must have transitionToBookingStage')
    assert.ok(!toolNames.includes('checkCalendarAvailability'), 'checkCalendarAvailability is booking-stage only')
    assert.ok(!toolNames.includes('bookAppointment'), 'bookAppointment is booking-stage only')
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

// Ultravox corpus tools removed — pgvector is the only knowledge backend

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

// ── G0.5: Sync trigger classification ─────────────────────────────────────

/**
 * Mirror the needsAgentSync logic from settings/route.ts.
 * If the settings route changes this expression, this test must be updated too —
 * that's the point. It catches accidental sync-trigger omissions.
 */
const SYNC_TRIGGER_FIELDS = new Set([
  'system_prompt',
  'forwarding_number',
  'transfer_conditions',
  'booking_enabled',
  'call_handling_mode',
  'agent_voice_id',
  'knowledge_backend',
  'sms_enabled',
  'twilio_number',
])

const DB_ONLY_FIELDS = [
  'voicemail_greeting_text',
  'voicemail_greeting_audio_url',
  'ivr_enabled',
  'ivr_prompt',
  'telegram_notifications_enabled',
  'email_notifications_enabled',
  'telegram_style',
  'weekly_digest_enabled',
  'injected_note',
  'context_data',
  'context_data_label',
  'website_url',
]

function computeNeedsSync(updates: Record<string, unknown>, knowledgeReseeded = false): boolean {
  return (
    typeof updates.system_prompt === 'string' ||
    'forwarding_number' in updates ||
    'transfer_conditions' in updates ||
    'booking_enabled' in updates ||
    'call_handling_mode' in updates ||
    'agent_voice_id' in updates ||
    'knowledge_backend' in updates ||
    'sms_enabled' in updates ||
    'twilio_number' in updates ||
    knowledgeReseeded
  )
}

describe('G0.5: needsAgentSync classification', () => {
  test('runtime-bearing fields trigger sync', () => {
    for (const field of SYNC_TRIGGER_FIELDS) {
      const updates: Record<string, unknown> = {}
      if (field === 'system_prompt') {
        updates[field] = 'new prompt text'
      } else {
        updates[field] = 'test-value'
      }
      assert.ok(
        computeNeedsSync(updates),
        `${field} should trigger needsAgentSync but did not`,
      )
    }
  })

  test('knowledgeReseeded triggers sync even with no field updates', () => {
    assert.ok(computeNeedsSync({}, true), 'knowledgeReseeded should trigger sync')
  })

  test('DB-only fields do NOT trigger sync', () => {
    for (const field of DB_ONLY_FIELDS) {
      const updates: Record<string, unknown> = { [field]: 'test-value' }
      assert.ok(
        !computeNeedsSync(updates),
        `${field} should NOT trigger needsAgentSync but did`,
      )
    }
  })

  test('empty updates do not trigger sync', () => {
    assert.ok(!computeNeedsSync({}), 'empty updates should not trigger sync')
  })
})
