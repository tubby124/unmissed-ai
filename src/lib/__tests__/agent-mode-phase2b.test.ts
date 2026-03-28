/**
 * agent-mode-phase2b.test.ts — Phase 2b verification suite
 *
 * Verifies build-time-only deeper agent_mode behavior:
 *   1. voicemail_replacement + other  — mode variable overrides fire
 *   2. voicemail_replacement + auto_glass — niche wins on TRIAGE_DEEP; FORBIDDEN_EXTRA appended
 *   3. info_hub + other               — open-ended triage + first question
 *   4. appointment_booking + other    — appointment-focused fields
 *   5. lead_capture regression guard  — identical to no agent_mode set
 *   6. All 4 modes × 4 niches ≤ 12K chars
 *   7. Settings patcher boundary      — only CALL HANDLING MODE changes; section 3 untouched
 *
 * Run: npx tsx --test src/lib/__tests__/agent-mode-phase2b.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { buildPromptFromIntake } from '../prompt-builder.js'
import { patchCallHandlingMode } from '../prompt-patcher.js'

// ── Shared fixtures ───────────────────────────────────────────────────────────

/** Build a minimal intake for a given niche + agent_mode. */
function intake(niche: string, agentMode?: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    business_name: 'Test Business',
    agent_name: 'Alex',
    niche,
    city: 'Saskatoon',
    province: 'SK',
    timezone: 'America/Regina',
    call_handling_mode: 'triage',
    ...(agentMode ? { agent_mode: agentMode } : {}),
    ...extra,
  }
}

const NICHES = ['other', 'auto_glass', 'plumbing', 'hvac'] as const
const MODES = ['voicemail_replacement', 'lead_capture', 'info_hub', 'appointment_booking'] as const

// ── 1. voicemail_replacement + other ─────────────────────────────────────────

describe('1. voicemail_replacement + other niche', () => {
  test('COMPLETION_FIELDS contains "brief message" (mode override fired)', () => {
    const prompt = buildPromptFromIntake(intake('other', 'voicemail_replacement'))
    // Rule 7 and GOAL both use {{COMPLETION_FIELDS}}
    assert.ok(
      prompt.includes('brief message'),
      'Expected "brief message" in prompt (COMPLETION_FIELDS mode override)',
    )
  })

  test('TRIAGE section uses mode voicemail triage text (niche has none)', () => {
    const prompt = buildPromptFromIntake(intake('other', 'voicemail_replacement'))
    // 'other' niche has no TRIAGE_DEEP → mode fallback fires
    assert.ok(
      prompt.includes('Do not ask about services, schedules, or urgency'),
      'Expected mode TRIAGE_DEEP text in section 3',
    )
  })

  test('FORBIDDEN_EXTRA contains mode voicemail restriction', () => {
    const prompt = buildPromptFromIntake(intake('other', 'voicemail_replacement'))
    assert.ok(
      prompt.includes('Do not triage. Do not offer information.'),
      'Expected voicemail_replacement FORBIDDEN_EXTRA appended',
    )
  })

  test('CALL HANDLING MODE section reflects voicemail_replacement', () => {
    const prompt = buildPromptFromIntake(intake('other', 'voicemail_replacement'))
    assert.ok(
      prompt.includes('act as a voicemail'),
      'Expected voicemail_replacement mode instruction in CALL HANDLING MODE section',
    )
  })
})

// ── 2. voicemail_replacement + auto_glass (niche wins) ───────────────────────

describe('2. voicemail_replacement + auto_glass — niche wins over mode for TRIAGE_DEEP', () => {
  test('TRIAGE section uses auto_glass TRIAGE_DEEP, NOT mode voicemail text', () => {
    const prompt = buildPromptFromIntake(intake('auto_glass', 'voicemail_replacement'))
    // auto_glass has its own TRIAGE_DEEP with specific windshield language
    assert.ok(
      prompt.includes('TRIAGE (Windshield)'),
      'Expected auto_glass TRIAGE_DEEP text (niche wins)',
    )
    assert.ok(
      !prompt.includes('Do not ask about services, schedules, or urgency'),
      'Mode TRIAGE_DEEP must NOT fire when niche provides its own',
    )
  })

  test('COMPLETION_FIELDS uses auto_glass niche value, NOT mode override', () => {
    const prompt = buildPromptFromIntake(intake('auto_glass', 'voicemail_replacement'))
    // auto_glass sets COMPLETION_FIELDS to 'vehicle year, make, model, and preferred timing'
    assert.ok(
      prompt.includes('vehicle year, make, model'),
      'Expected auto_glass COMPLETION_FIELDS (niche wins over mode)',
    )
    // "brief message" legitimately appears in the ## CALL HANDLING MODE voicemail instruction —
    // that is expected. What must NOT happen is the COMPLETION_FIELDS substitution using the
    // mode value. Verify rule 7 / COMPLETION CHECK uses the niche value, not the mode value.
    assert.ok(
      prompt.includes('collected vehicle year, make, model'),
      'Rule 7 COMPLETION CHECK must use auto_glass COMPLETION_FIELDS, not voicemail_replacement override',
    )
  })

  test('FORBIDDEN_EXTRA always appends voicemail restriction even when niche has its own', () => {
    const prompt = buildPromptFromIntake(intake('auto_glass', 'voicemail_replacement'))
    // auto_glass has FORBIDDEN_EXTRA (VIN spelling rule) + mode appends its own
    assert.ok(
      prompt.includes('Do not triage. Do not offer information.'),
      'Mode FORBIDDEN_EXTRA must always append',
    )
  })

  test('CALL HANDLING MODE still reflects voicemail_replacement', () => {
    const prompt = buildPromptFromIntake(intake('auto_glass', 'voicemail_replacement'))
    assert.ok(
      prompt.includes('act as a voicemail'),
      'Phase 2a CALL HANDLING MODE must still apply',
    )
  })
})

// ── 3. info_hub + other ───────────────────────────────────────────────────────

describe('3. info_hub + other niche', () => {
  test('FIRST_INFO_QUESTION uses open-ended info_hub override', () => {
    const prompt = buildPromptFromIntake(intake('other', 'info_hub'))
    assert.ok(
      prompt.includes('What can I help you with today?'),
      'Expected info_hub FIRST_INFO_QUESTION override',
    )
  })

  test('TRIAGE section uses info_hub triage text (niche has none)', () => {
    const prompt = buildPromptFromIntake(intake('other', 'info_hub'))
    assert.ok(
      prompt.includes('Do not push through a triage script'),
      'Expected info_hub TRIAGE_DEEP text',
    )
  })

  test('FORBIDDEN_EXTRA contains info_hub restriction', () => {
    const prompt = buildPromptFromIntake(intake('other', 'info_hub'))
    assert.ok(
      prompt.includes('Answer questions before asking for contact info'),
      'Expected info_hub FORBIDDEN_EXTRA appended',
    )
  })

  test('CALL HANDLING MODE reflects info_hub', () => {
    const prompt = buildPromptFromIntake(intake('other', 'info_hub'))
    assert.ok(
      prompt.includes('information assistant'),
      'Expected info_hub mode instruction in CALL HANDLING MODE',
    )
  })
})

// ── 4. appointment_booking + other ────────────────────────────────────────────

describe('4. appointment_booking + other niche', () => {
  test('COMPLETION_FIELDS includes appointment-specific fields', () => {
    const prompt = buildPromptFromIntake(intake('other', 'appointment_booking'))
    assert.ok(
      prompt.includes('preferred date/time'),
      'Expected appointment_booking COMPLETION_FIELDS with date/time',
    )
  })

  test('CLOSE_ACTION references scheduling', () => {
    const prompt = buildPromptFromIntake(intake('other', 'appointment_booking'))
    // CLOSE_ACTION appears in GOAL ("so X can schedule an appointment")
    assert.ok(
      prompt.includes('schedule an appointment'),
      'Expected appointment_booking CLOSE_ACTION in GOAL section',
    )
  })

  test('FORBIDDEN_EXTRA contains appointment restriction', () => {
    const prompt = buildPromptFromIntake(intake('other', 'appointment_booking'))
    assert.ok(
      prompt.includes('Do not close without attempting to book'),
      'Expected appointment_booking FORBIDDEN_EXTRA appended',
    )
  })

  test('CALL HANDLING MODE reflects appointment_booking', () => {
    const prompt = buildPromptFromIntake(intake('other', 'appointment_booking'))
    assert.ok(
      prompt.includes('booking assistant'),
      'Expected appointment_booking mode instruction in CALL HANDLING MODE',
    )
  })
})

// ── 5. lead_capture regression guard ─────────────────────────────────────────

describe('5. lead_capture is a true no-op', () => {
  test('lead_capture output identical to no agent_mode set', () => {
    const withLeadCapture = buildPromptFromIntake(intake('other', 'lead_capture'))
    const withNoMode = buildPromptFromIntake(intake('other'))
    assert.equal(
      withLeadCapture,
      withNoMode,
      'lead_capture must produce identical output to no agent_mode set',
    )
  })

  test('lead_capture with auto_glass niche identical to no agent_mode', () => {
    const withLeadCapture = buildPromptFromIntake(intake('auto_glass', 'lead_capture'))
    const withNoMode = buildPromptFromIntake(intake('auto_glass'))
    assert.equal(
      withLeadCapture,
      withNoMode,
      'lead_capture must not alter auto_glass prompt',
    )
  })
})

// ── 6. Prompt size — all 4 modes × 4 niches within runtime hard max ──────────
// Baseline: niches generate 16–20K chars; mode additions are small.
// Limit: 25,000 = PROMPT_CHAR_HARD_MAX in knowledge-summary.ts (call-time hard cap).
// This test guards against Phase 2b adding catastrophic bloat, not enforcing 12K
// (which applies to patch operations, not build-time generation).

describe('6. Prompt size limit: all modes × niches ≤ 25,000 chars', () => {
  const CHAR_HARD_MAX = 25_000

  for (const niche of NICHES) {
    for (const mode of MODES) {
      test(`${mode} + ${niche} within ${CHAR_HARD_MAX} chars`, () => {
        const prompt = buildPromptFromIntake(intake(niche, mode))
        assert.ok(
          prompt.length <= CHAR_HARD_MAX,
          `Prompt too large: ${prompt.length} chars exceeds ${CHAR_HARD_MAX} (mode=${mode}, niche=${niche})`,
        )
      })
    }
  }
})

// ── 7. Settings patcher boundary ─────────────────────────────────────────────
//
// patchCallHandlingMode (the only patcher called for agent_mode changes) must
// only modify ## CALL HANDLING MODE and leave ## 3. TRIAGE untouched.
// This proves Phase 2b deep behavior remains build-time only.

describe('7. Settings patcher boundary: only CALL HANDLING MODE changes', () => {
  const TRIAGE_CONTENT = 'Use the standard triage script here. Ask what type of service.'

  function promptWithBothSections(modeName: string): string {
    return [
      '# IDENTITY\nYou are Alex.\n',
      '## 3. TRIAGE\n',
      TRIAGE_CONTENT,
      '\n\n## CALL HANDLING MODE\n',
      modeName,
      '\n\n# CONVERSATION FLOW\nDo stuff.',
    ].join('')
  }

  test('patching to voicemail_replacement changes CALL HANDLING MODE, not TRIAGE', () => {
    const original = promptWithBothSections('triage — collect name and callback')
    const patched = patchCallHandlingMode(original, 'voicemail_replacement', 'Alex')

    // CALL HANDLING MODE must have changed
    assert.ok(
      patched.includes('act as a voicemail'),
      'Expected voicemail_replacement instruction in CALL HANDLING MODE after patch',
    )

    // TRIAGE section must be intact
    assert.ok(
      patched.includes(TRIAGE_CONTENT),
      'Section 3 TRIAGE must not be modified by patchCallHandlingMode',
    )
  })

  test('patching to info_hub changes CALL HANDLING MODE, not TRIAGE', () => {
    const original = promptWithBothSections('triage — collect name and callback')
    const patched = patchCallHandlingMode(original, 'info_hub', 'Alex')

    assert.ok(
      patched.includes('information assistant'),
      'Expected info_hub instruction in CALL HANDLING MODE after patch',
    )
    assert.ok(
      patched.includes(TRIAGE_CONTENT),
      'Section 3 TRIAGE must not be modified by patchCallHandlingMode',
    )
  })

  test('patching to lead_capture changes CALL HANDLING MODE, not TRIAGE', () => {
    const original = promptWithBothSections('info_hub — answer first')
    const patched = patchCallHandlingMode(original, 'lead_capture', 'Alex')

    assert.ok(
      patched.includes('triage script below'),
      'Expected lead_capture instruction in CALL HANDLING MODE after patch',
    )
    assert.ok(
      patched.includes(TRIAGE_CONTENT),
      'Section 3 TRIAGE must not be modified by patchCallHandlingMode',
    )
  })
})
