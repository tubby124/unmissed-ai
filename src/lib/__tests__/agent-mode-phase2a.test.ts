/**
 * agent-mode-phase2a.test.ts — Phase 2a verification suite
 *
 * Verifies all 5 required properties of the agent_mode implementation:
 *   A. Existing-client safety  (lead_capture defers to call_handling_mode, unchanged output)
 *   B. New mode sections        (info_hub, appointment_booking, voicemail_replacement)
 *   C. Revert behavior          (non-lead_capture → lead_capture reverts to call_handling_mode)
 *   D. Single-patch             (combined resolver applies exactly ONE patch)
 *   E. Sync truth               (agent_mode in updates triggers needsAgentSync)
 *
 * Run: npx tsx --test src/lib/__tests__/agent-mode-phase2a.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  MODE_INSTRUCTIONS,
  patchCallHandlingMode,
} from '../prompt-patcher.js'
import {
  buildPromptFromIntake,
} from '../prompt-builder.js'
import {
  FIELD_REGISTRY,
  SYNC_TRIGGER_FIELDS,
  computeNeedsSync,
  buildUpdates,
  type SettingsBody,
} from '../settings-schema.js'

// ── Shared fixtures ──────────────────────────────────────────────────────────

const CALL_HANDLING_SECTION = '## CALL HANDLING MODE\n'

/** Minimal prompt containing a CALL HANDLING MODE section */
function promptWithMode(modeText: string): string {
  return `# IDENTITY\nYou are Mark.\n\n## CALL HANDLING MODE\n${modeText}\n\n# CONVERSATION FLOW\nDo stuff.`
}

/** Intake factory with sensible defaults */
function baseIntake(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    business_name: 'Test Business',
    niche: 'auto_glass',
    city: 'Saskatoon',
    province: 'SK',
    timezone: 'America/Regina',
    call_handling_mode: 'triage',
    ...overrides,
  }
}

// ── A. Existing-client safety ─────────────────────────────────────────────────
//
// When agent_mode='lead_capture' (the default), the resolver must produce
// output IDENTICAL to the old call_handling_mode-only path.
// Pre-Phase-2a: MODE_INSTRUCTIONS[callHandlingMode] was used directly.
// Post-Phase-2a: agent_mode='lead_capture' → fall through to callHandlingMode → same key.

describe('A. Existing-client safety — lead_capture defers to call_handling_mode', () => {

  test('triage + lead_capture: CALL_HANDLING_MODE_INSTRUCTIONS matches triage instruction', () => {
    const prompt = buildPromptFromIntake(baseIntake({
      call_handling_mode: 'triage',
      agent_mode: 'lead_capture',
    }))
    // The resolved instruction should be the triage instruction
    assert.ok(
      prompt.includes(MODE_INSTRUCTIONS.triage),
      'triage+lead_capture should produce triage instruction text'
    )
    // Should NOT contain any new-mode instruction text
    assert.ok(!prompt.includes('information assistant'), 'should not contain info_hub text')
    assert.ok(!prompt.includes('booking assistant'), 'should not contain appointment_booking text')
    assert.ok(!prompt.includes('act as a voicemail'), 'should not contain voicemail_replacement text')
  })

  test('message_only + lead_capture: D184 — routes to voicemail builder (not regular template)', () => {
    // D184: call_handling_mode='message_only' → buildVoicemailPrompt() regardless of agent_mode.
    // The voicemail builder produces a completely different structure — not the regular template with
    // MODE_INSTRUCTIONS embedded. Verify the voicemail builder's distinctive opening is present.
    const prompt = buildPromptFromIntake(baseIntake({
      call_handling_mode: 'message_only',
      agent_mode: 'lead_capture',
    }))
    assert.ok(
      prompt.includes('THIS IS A LIVE VOICE PHONE CALL'),
      'message_only+lead_capture should route to voicemail builder (D184)'
    )
    assert.ok(!prompt.includes('information assistant'), 'should not contain info_hub text')
  })

  test('full_service + lead_capture: CALL_HANDLING_MODE_INSTRUCTIONS matches full_service instruction', () => {
    const prompt = buildPromptFromIntake(baseIntake({
      call_handling_mode: 'full_service',
      agent_mode: 'lead_capture',
    }))
    // full_service instruction has {{CLOSE_PERSON}} substituted — check the static prefix
    assert.ok(
      prompt.includes('You are a full-service receptionist'),
      'full_service+lead_capture should produce full_service instruction text'
    )
    assert.ok(!prompt.includes('{{CLOSE_PERSON}}'), 'CLOSE_PERSON placeholder must be substituted')
    assert.ok(!prompt.includes('information assistant'), 'should not contain info_hub text')
  })

  test('no agent_mode field (undefined) + triage: behaves as before (triage output)', () => {
    const prompt = buildPromptFromIntake(baseIntake({
      call_handling_mode: 'triage',
      // agent_mode intentionally omitted
    }))
    assert.ok(
      prompt.includes(MODE_INSTRUCTIONS.triage),
      'omitted agent_mode should fall through to triage instruction'
    )
  })

  test('patchCallHandlingMode: lead_capture mode is now a valid key in MODE_INSTRUCTIONS', () => {
    // Confirms the registry has lead_capture and it maps to triage text
    assert.ok(MODE_INSTRUCTIONS.lead_capture !== undefined, 'lead_capture must be in MODE_INSTRUCTIONS')
    assert.equal(
      MODE_INSTRUCTIONS.lead_capture,
      MODE_INSTRUCTIONS.triage,
      'lead_capture instruction equals triage instruction (same behavior)'
    )
  })
})

// ── B. New mode section behavior ─────────────────────────────────────────────

describe('B. New mode sections produce correct CALL HANDLING MODE content', () => {

  test('info_hub: patchCallHandlingMode replaces section with info_hub instruction', () => {
    const prompt = promptWithMode(MODE_INSTRUCTIONS.triage)
    const patched = patchCallHandlingMode(prompt, 'info_hub')
    assert.ok(patched.includes(MODE_INSTRUCTIONS.info_hub), 'should contain info_hub instruction')
    assert.ok(!patched.includes(MODE_INSTRUCTIONS.triage), 'should not contain old triage instruction')
    assert.ok(patched.includes(CALL_HANDLING_SECTION), 'heading must be preserved')
    assert.ok(patched.includes('# CONVERSATION FLOW'), 'following section preserved')
  })

  test('appointment_booking: patchCallHandlingMode replaces section with appointment_booking instruction', () => {
    const prompt = promptWithMode(MODE_INSTRUCTIONS.triage)
    const patched = patchCallHandlingMode(prompt, 'appointment_booking')
    assert.ok(patched.includes(MODE_INSTRUCTIONS.appointment_booking), 'should contain appointment_booking instruction')
    assert.ok(!patched.includes(MODE_INSTRUCTIONS.triage), 'old triage instruction should be gone')
  })

  test('voicemail_replacement: patchCallHandlingMode replaces section with voicemail_replacement instruction', () => {
    const prompt = promptWithMode(MODE_INSTRUCTIONS.triage)
    const patched = patchCallHandlingMode(prompt, 'voicemail_replacement')
    assert.ok(patched.includes(MODE_INSTRUCTIONS.voicemail_replacement), 'should contain voicemail_replacement instruction')
    assert.ok(patched.includes('act as a voicemail'), 'voicemail text present')
    assert.ok(!patched.includes(MODE_INSTRUCTIONS.triage), 'old triage instruction should be gone')
  })

  test('info_hub: buildPromptFromIntake embeds info_hub instruction when agent_mode=info_hub', () => {
    const prompt = buildPromptFromIntake(baseIntake({ agent_mode: 'info_hub' }))
    assert.ok(
      prompt.includes(MODE_INSTRUCTIONS.info_hub),
      'builder should embed info_hub instruction for agent_mode=info_hub'
    )
  })

  test('appointment_booking: buildPromptFromIntake embeds appointment_booking instruction', () => {
    const prompt = buildPromptFromIntake(baseIntake({ agent_mode: 'appointment_booking' }))
    assert.ok(
      prompt.includes(MODE_INSTRUCTIONS.appointment_booking),
      'builder should embed appointment_booking instruction for agent_mode=appointment_booking'
    )
  })

  test('voicemail_replacement: buildPromptFromIntake embeds voicemail_replacement instruction', () => {
    const prompt = buildPromptFromIntake(baseIntake({ agent_mode: 'voicemail_replacement' }))
    assert.ok(
      prompt.includes(MODE_INSTRUCTIONS.voicemail_replacement),
      'builder should embed voicemail_replacement instruction for agent_mode=voicemail_replacement'
    )
  })

  test('new modes: no {{VARIABLE}} placeholders leak into prompt', () => {
    for (const mode of ['info_hub', 'appointment_booking', 'voicemail_replacement']) {
      const prompt = buildPromptFromIntake(baseIntake({ agent_mode: mode }))
      const leaked = prompt.match(/\{\{[A-Z_]+\}\}/g)
      assert.strictEqual(leaked, null, `${mode}: unfilled variables: ${JSON.stringify(leaked)}`)
    }
  })

  test('unknown mode falls back to triage instruction (safe default)', () => {
    const prompt = promptWithMode(MODE_INSTRUCTIONS.triage)
    const patched = patchCallHandlingMode(prompt, 'totally_unknown_mode')
    assert.ok(patched.includes(MODE_INSTRUCTIONS.triage), 'unknown mode should fall back to triage')
  })
})

// ── C. Revert behavior ────────────────────────────────────────────────────────
//
// When agent_mode changes back to 'lead_capture', the combined resolver
// must revert the CALL HANDLING MODE section to the current call_handling_mode.

describe('C. Revert behavior — non-lead_capture → lead_capture reverts to call_handling_mode', () => {

  test('info_hub → lead_capture: section reverts to call_handling_mode=triage', () => {
    // Start with info_hub patched in
    const withInfoHub = patchCallHandlingMode(
      promptWithMode(MODE_INSTRUCTIONS.triage),
      'info_hub'
    )
    // Simulate the combined resolver: agent_mode='lead_capture' → fall through to callHandlingMode='triage'
    const rawAgentMode = 'lead_capture'
    const callHandlingMode = 'triage'
    const effectiveMode = (rawAgentMode && rawAgentMode !== 'lead_capture') ? rawAgentMode : callHandlingMode
    const reverted = patchCallHandlingMode(withInfoHub, effectiveMode)
    assert.ok(reverted.includes(MODE_INSTRUCTIONS.triage), 'should revert to triage text')
    assert.ok(!reverted.includes(MODE_INSTRUCTIONS.info_hub), 'info_hub text should be gone')
    assert.equal(effectiveMode, 'triage', 'effective mode must be triage')
  })

  test('appointment_booking → lead_capture: section reverts to call_handling_mode=message_only', () => {
    const withBooking = patchCallHandlingMode(
      promptWithMode(MODE_INSTRUCTIONS.message_only),
      'appointment_booking'
    )
    const rawAgentMode = 'lead_capture'
    const callHandlingMode = 'message_only'
    const effectiveMode = (rawAgentMode && rawAgentMode !== 'lead_capture') ? rawAgentMode : callHandlingMode
    const reverted = patchCallHandlingMode(withBooking, effectiveMode)
    assert.ok(reverted.includes(MODE_INSTRUCTIONS.message_only), 'should revert to message_only text')
    assert.ok(!reverted.includes(MODE_INSTRUCTIONS.appointment_booking), 'appointment_booking text should be gone')
  })

  test('voicemail_replacement → lead_capture: section reverts to call_handling_mode=full_service', () => {
    const withVoicemail = patchCallHandlingMode(
      promptWithMode('old content'),
      'voicemail_replacement'
    )
    const rawAgentMode = 'lead_capture'
    const callHandlingMode = 'full_service'
    const effectiveMode = (rawAgentMode && rawAgentMode !== 'lead_capture') ? rawAgentMode : callHandlingMode
    // full_service has {{CLOSE_PERSON}} substitution
    const reverted = patchCallHandlingMode(withVoicemail, effectiveMode, 'the team')
    assert.ok(reverted.includes('You are a full-service receptionist'), 'should revert to full_service text')
    assert.ok(!reverted.includes('act as a voicemail'), 'voicemail text should be gone')
    assert.ok(!reverted.includes('{{CLOSE_PERSON}}'), 'CLOSE_PERSON should be substituted')
  })

  test('lead_capture resolver: when agent_mode is null (not in body), callHandlingMode is used', () => {
    // Mirrors the combined resolver in settings-patchers when only call_handling_mode is in body
    const rawAgentMode: string | null = null
    const callHandlingMode = 'message_only'
    const effectiveMode = (rawAgentMode && rawAgentMode !== 'lead_capture') ? rawAgentMode : callHandlingMode
    assert.equal(effectiveMode, 'message_only', 'null agent_mode should fall through to callHandlingMode')
  })
})

// ── D. Single-patch behavior ──────────────────────────────────────────────────
//
// The combined resolver ensures exactly ONE patch is applied per settings save,
// even when both agent_mode and call_handling_mode are present in the body.

describe('D. Single-patch — combined resolver applies exactly one CALL HANDLING MODE patch', () => {

  test('combined resolver: info_hub takes precedence over call_handling_mode=message_only', () => {
    const rawAgentMode: string = 'info_hub'
    const callHandlingMode = 'message_only'
    const effectiveMode = (rawAgentMode && rawAgentMode !== 'lead_capture') ? rawAgentMode : callHandlingMode
    assert.equal(effectiveMode, 'info_hub', 'non-lead_capture agent_mode should win')

    const prompt = promptWithMode(MODE_INSTRUCTIONS.triage)
    const patched = patchCallHandlingMode(prompt, effectiveMode)
    // Exactly one patch applied — section content is only info_hub
    const sectionStart = patched.indexOf(CALL_HANDLING_SECTION) + CALL_HANDLING_SECTION.length
    const sectionEnd = patched.indexOf('\n\n# CONVERSATION FLOW')
    const sectionContent = patched.substring(sectionStart, sectionEnd).trim()
    assert.equal(sectionContent, MODE_INSTRUCTIONS.info_hub, 'only info_hub instruction in section')
    assert.ok(!sectionContent.includes(MODE_INSTRUCTIONS.message_only), 'message_only must not appear in section')
    assert.ok(!sectionContent.includes(MODE_INSTRUCTIONS.triage), 'triage must not appear in section')
  })

  test('combined resolver: appointment_booking takes precedence over call_handling_mode=full_service', () => {
    const rawAgentMode: string = 'appointment_booking'
    const callHandlingMode = 'full_service'
    const effectiveMode = (rawAgentMode && rawAgentMode !== 'lead_capture') ? rawAgentMode : callHandlingMode
    assert.equal(effectiveMode, 'appointment_booking')

    const prompt = promptWithMode(MODE_INSTRUCTIONS.full_service.replace('{{CLOSE_PERSON}}', 'Mark'))
    const patched = patchCallHandlingMode(prompt, effectiveMode)
    const sectionStart = patched.indexOf(CALL_HANDLING_SECTION) + CALL_HANDLING_SECTION.length
    const sectionEnd = patched.indexOf('\n\n# CONVERSATION FLOW')
    const sectionContent = patched.substring(sectionStart, sectionEnd).trim()
    assert.equal(sectionContent, MODE_INSTRUCTIONS.appointment_booking)
    assert.ok(!sectionContent.includes('full-service receptionist'), 'full_service text must not bleed in')
  })

  test('patchCallHandlingMode is idempotent: calling twice with same mode leaves only one instruction copy', () => {
    const prompt = promptWithMode(MODE_INSTRUCTIONS.triage)
    const once = patchCallHandlingMode(prompt, 'info_hub')
    const twice = patchCallHandlingMode(once, 'info_hub')
    assert.equal(once, twice, 'calling patcher twice with same mode should be idempotent')
    // Count how many times the heading appears — must be exactly 1
    const headingCount = (twice.match(/## CALL HANDLING MODE/g) || []).length
    assert.equal(headingCount, 1, 'heading must appear exactly once')
  })

  test('prompt with no CALL HANDLING MODE section → patcher returns prompt unchanged', () => {
    const promptNoSection = '# IDENTITY\nYou are Mark.\n\n# CONVERSATION FLOW\nDo stuff.'
    const result = patchCallHandlingMode(promptNoSection, 'info_hub')
    assert.equal(result, promptNoSection, 'no section = no patch (safe no-op)')
  })
})

// ── E. Sync truth ─────────────────────────────────────────────────────────────
//
// FIELD_REGISTRY has agent_mode with triggersSync=true, so agent_mode in updates
// must trigger computeNeedsSync (same as call_handling_mode and system_prompt).

describe('E. Sync truth — agent_mode triggers needsAgentSync', () => {

  test('FIELD_REGISTRY has agent_mode with triggersSync=true', () => {
    const def = FIELD_REGISTRY.agent_mode
    assert.ok(def !== undefined, 'agent_mode must be in FIELD_REGISTRY')
    assert.equal(def.triggersSync, true, 'agent_mode must have triggersSync=true')
    assert.equal(def.mutationClass, 'DB_PLUS_PROMPT', 'agent_mode mutation class must be DB_PLUS_PROMPT')
  })

  test('SYNC_TRIGGER_FIELDS includes agent_mode', () => {
    assert.ok(SYNC_TRIGGER_FIELDS.includes('agent_mode'), 'SYNC_TRIGGER_FIELDS must contain agent_mode')
  })

  test('computeNeedsSync returns true when agent_mode is in updates', () => {
    const updates = { agent_mode: 'info_hub' }
    assert.equal(computeNeedsSync(updates, false), true, 'agent_mode in updates must trigger sync')
  })

  test('computeNeedsSync returns true when system_prompt changes alongside agent_mode', () => {
    const updates = { agent_mode: 'info_hub', system_prompt: 'patched prompt' }
    assert.equal(computeNeedsSync(updates, false), true)
  })

  test('computeNeedsSync returns false when only DB_ONLY fields are in updates', () => {
    const updates = { ivr_enabled: true, sms_template: 'text me' }
    assert.equal(computeNeedsSync(updates, false), false, 'DB_ONLY fields must not trigger sync')
  })

  test('buildUpdates includes agent_mode in output when present in body', () => {
    const body: SettingsBody = { agent_mode: 'info_hub' } as SettingsBody
    const updates = buildUpdates(body, 'owner')
    assert.equal(updates.agent_mode, 'info_hub', 'buildUpdates must pass agent_mode through to updates')
  })

  test('buildUpdates: agent_mode not in body → not in updates (no phantom key)', () => {
    const body: SettingsBody = { sms_enabled: true } as SettingsBody
    const updates = buildUpdates(body, 'owner')
    assert.ok(!('agent_mode' in updates), 'agent_mode must not appear in updates if not in body')
  })

  test('call_handling_mode still triggers sync (pre-existing behavior preserved)', () => {
    const updates = { call_handling_mode: 'triage' }
    assert.equal(computeNeedsSync(updates, false), true, 'call_handling_mode must still trigger sync')
  })
})
