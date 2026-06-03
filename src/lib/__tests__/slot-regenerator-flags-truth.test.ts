/**
 * slot-regenerator-flags-truth.test.ts
 *
 * Regression contract: buildAgentFlagsFromClient → buildAgentTools must preserve
 * every niche/plan/capability flag that gates tool registration. Caused a
 * production regression 2026-06-02 when `niche` was missing from the flag
 * builder: every regenerateSlot/regenerateSlots/recomposePrompt on a
 * property_management client silently dropped submitMaintenanceRequest from
 * clients.tools (runtime-authoritative source of tools per the architecture
 * contract).
 *
 * The test fixture mimics a real Brian-shaped client row. Add new fields here
 * whenever buildAgentTools starts gating on a new column.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildAgentFlagsFromClient } from '../slot-regenerator.js'
import { buildAgentTools } from '../ultravox.js'

function toolNames(tools: object[]): string[] {
  return tools.map(t => {
    const obj = t as Record<string, any>
    if (obj.toolName) return obj.toolName
    return obj.temporaryTool?.modelToolName ?? 'unknown'
  })
}

// Realistic Brian-shaped client row (PM trial + pgvector + SMS + no transfer).
function brianLikeClient(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: '2c186f70-84cc-4253-a3ab-6cd0e9064d39',
    slug: 'calgary-property-leasing',
    niche: 'property_management',
    agent_voice_id: 'voice-test',
    selected_plan: 'core',
    subscription_status: 'trialing',
    sms_enabled: true,
    twilio_number: '+16397393885',
    forwarding_number: null,
    booking_enabled: false,
    knowledge_backend: 'pgvector',
    transfer_conditions: null,
    system_prompt: '<test-prompt>',
    ...overrides,
  }
}

describe('buildAgentFlagsFromClient → buildAgentTools — niche tool gating', () => {
  test('property_management client → submitMaintenanceRequest registered after the round-trip', () => {
    const client = brianLikeClient()
    const flags = buildAgentFlagsFromClient(client, client.system_prompt, /* chunks */ 52)
    const tools = buildAgentTools(flags)
    const names = toolNames(tools)
    assert.ok(
      names.includes('submitMaintenanceRequest'),
      `submitMaintenanceRequest must survive the flag round-trip for property_management. Got: ${names.join(', ')}`,
    )
  })

  test('legacy property-management hyphen niche → submitMaintenanceRequest registered', () => {
    const client = brianLikeClient({ niche: 'property-management' })
    const flags = buildAgentFlagsFromClient(client, client.system_prompt, 16)
    const tools = buildAgentTools(flags)
    assert.ok(
      toolNames(tools).includes('submitMaintenanceRequest'),
      'submitMaintenanceRequest must survive for legacy hyphen niche too',
    )
  })

  test('non-PM niche → submitMaintenanceRequest NOT registered (gating still works)', () => {
    const client = brianLikeClient({ niche: 'real_estate' })
    const flags = buildAgentFlagsFromClient(client, client.system_prompt, 30)
    const tools = buildAgentTools(flags)
    assert.ok(
      !toolNames(tools).includes('submitMaintenanceRequest'),
      'Maintenance tool must remain PM-only — should not bleed into real_estate',
    )
  })

  test('pgvector + chunks > 0 → queryKnowledge registered', () => {
    const client = brianLikeClient()
    const flags = buildAgentFlagsFromClient(client, client.system_prompt, 52)
    const tools = buildAgentTools(flags)
    assert.ok(
      toolNames(tools).includes('queryKnowledge'),
      'queryKnowledge must be registered when pgvector + chunks > 0',
    )
  })

  test('pgvector + chunks=0 → queryKnowledge NOT registered (safe default)', () => {
    const client = brianLikeClient()
    const flags = buildAgentFlagsFromClient(client, client.system_prompt, 0)
    const tools = buildAgentTools(flags)
    assert.ok(
      !toolNames(tools).includes('queryKnowledge'),
      'queryKnowledge must NOT register when corpus is empty',
    )
  })

  test('sms_enabled + twilio_number → sendTextMessage registered', () => {
    const client = brianLikeClient()
    const flags = buildAgentFlagsFromClient(client, client.system_prompt, 0)
    const tools = buildAgentTools(flags)
    assert.ok(
      toolNames(tools).includes('sendTextMessage'),
      'sendTextMessage must register when sms_enabled + twilio_number present',
    )
  })

  test('forwarding_number set → transferCall registered (PRO plan)', () => {
    const client = brianLikeClient({
      forwarding_number: '+15555550100',
      selected_plan: 'pro',
      transfer_conditions: 'callers asking for the owner',
    })
    const flags = buildAgentFlagsFromClient(client, client.system_prompt, 0)
    const tools = buildAgentTools(flags)
    assert.ok(
      toolNames(tools).includes('transferCall'),
      'transferCall must register when forwarding_number + pro plan present',
    )
  })

  test('flag object includes every documented field — schema contract', () => {
    // If buildAgentTools ever starts reading a new client field, the flag builder
    // MUST propagate it. This test pins the schema so the regression repeats only
    // after a deliberate update.
    const client = brianLikeClient()
    const flags = buildAgentFlagsFromClient(client, client.system_prompt, 52) as Record<string, any>
    const expectedKeys = [
      'systemPrompt',
      'voice',
      'booking_enabled',
      'slug',
      'sms_enabled',
      'knowledge_backend',
      'knowledge_chunk_count',
      'selectedPlan',
      'subscriptionStatus',
      'niche', // ← regression: this was missing before 2026-06-02
    ]
    for (const key of expectedKeys) {
      assert.ok(
        key in flags,
        `flag builder MUST include "${key}" — buildAgentTools reads it for tool gating`,
      )
    }
  })
})
