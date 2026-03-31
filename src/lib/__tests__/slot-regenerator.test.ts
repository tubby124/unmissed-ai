/**
 * slot-regenerator.test.ts — Round-trip tests for clientRowToIntake bridge.
 *
 * Verifies that converting a simulated client DB row back to intake format
 * produces the same SlotContext (and therefore the same prompt) as the
 * original intake path.
 *
 * This is critical because clientRowToIntake is the bridge between
 * "stored DB state" and "onboarding intake format". If any mapping is wrong,
 * regenerateSlot() silently produces the wrong prompt.
 *
 * Run: npx tsx --test src/lib/__tests__/slot-regenerator.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { buildSlotContext, buildPromptFromSlots } from '../prompt-slots.js'

// We can't import clientRowToIntake directly (it's not exported),
// so we test the full path: simulate a client row → build intake → build prompt.
// The key assertion: fields that exist in both intake and client row
// produce identical SlotContext values.

/**
 * Simulate a client DB row from intake data.
 * This mirrors what would be in the clients table after onboarding.
 */
function intakeToSimulatedClientRow(intake: Record<string, unknown>): Record<string, unknown> {
  return {
    // Core identity
    niche: intake.niche,
    business_name: intake.business_name,
    agent_name: intake.agent_name ?? intake.db_agent_name,
    city: intake.city,
    owner_name: intake.owner_name,

    // Hours
    business_hours_weekday: intake.hours_weekday,

    // Services
    services_offered: intake.services_offered,
    services_not_offered: intake.services_not_offered,

    // Contact
    callback_phone: intake.callback_phone,
    forwarding_number: intake.owner_phone,
    after_hours_emergency_phone: intake.emergency_phone,

    // Mode
    call_handling_mode: intake.call_handling_mode ?? 'triage',
    agent_mode: intake.agent_mode,

    // Voice
    voice_style_preset: intake.voice_style_preset,
    agent_tone: intake.agent_tone,

    // Features
    booking_enabled: intake.booking_enabled ?? false,
    sms_enabled: intake.sms_enabled ?? false,

    // Knowledge
    knowledge_backend: intake.knowledge_backend ?? '',
    pricing_policy: intake.pricing_policy,
    unknown_answer_behavior: intake.unknown_answer_behavior,
    caller_faq: intake.caller_faq,
    common_objections: intake.common_objections,
    extra_qa: intake.niche_faq_pairs ? JSON.parse(intake.niche_faq_pairs as string) : undefined,

    // Completion
    completion_fields: intake.completion_fields,

    // Agent restrictions
    agent_restrictions: intake.agent_restrictions,

    // Insurance
    insurance_preset: intake.insurance_preset,
    insurance_status: intake.insurance_status,
    insurance_detail: intake.insurance_detail,

    // Niche custom variables
    niche_custom_variables: intake.niche_custom_variables,

    // After hours
    after_hours_behavior: intake.after_hours_behavior ?? 'standard',
  }
}

/**
 * Convert a simulated client row back to intake format.
 * This is the same logic as clientRowToIntake in slot-regenerator.ts.
 * Duplicated here to test the mapping without importing the private function.
 */
function clientRowToIntake(
  client: Record<string, unknown>,
  knowledgeChunkCount = 0,
): Record<string, unknown> {
  return {
    niche: client.niche,
    business_name: client.business_name,
    agent_name: client.agent_name,
    db_agent_name: client.agent_name,
    city: client.city,
    owner_name: client.owner_name,
    hours_weekday: client.business_hours_weekday,
    services_offered: client.services_offered,
    services_not_offered: client.services_not_offered,
    callback_phone: client.callback_phone,
    owner_phone: client.forwarding_number,
    emergency_phone: client.after_hours_emergency_phone,
    call_handling_mode: client.call_handling_mode ?? 'triage',
    agent_mode: client.agent_mode,
    voice_style_preset: client.voice_style_preset,
    agent_tone: client.agent_tone,
    booking_enabled: client.booking_enabled,
    sms_enabled: client.sms_enabled,
    forwarding_number: client.forwarding_number,
    after_hours_behavior: client.after_hours_behavior ?? 'standard',
    knowledge_backend: client.knowledge_backend,
    knowledge_chunk_count: knowledgeChunkCount,
    pricing_policy: client.pricing_policy,
    unknown_answer_behavior: client.unknown_answer_behavior,
    caller_faq: client.caller_faq,
    common_objections: client.common_objections,
    niche_faq_pairs: client.extra_qa ? JSON.stringify(client.extra_qa) : undefined,
    completion_fields: client.completion_fields,
    agent_restrictions: client.agent_restrictions,
    insurance_preset: client.insurance_preset,
    insurance_status: client.insurance_status,
    insurance_detail: client.insurance_detail,
    niche_custom_variables: client.niche_custom_variables,
  }
}

// ── Test cases ──────────────────────────────────────────────────────────────────

describe('clientRowToIntake round-trip', () => {
  const NICHES_TO_TEST = [
    {
      name: 'auto_glass baseline',
      intake: {
        niche: 'auto_glass',
        business_name: 'Quick Glass',
        agent_name: 'Blake',
        city: 'Calgary',
        owner_name: 'Mark Johnson',
        hours_weekday: 'Mon-Fri 8am-5pm',
        call_handling_mode: 'triage',
      },
    },
    // NOTE: niche-specific intake fields (niche_emergency, niche_clientType, etc.)
    // are NOT stored as individual DB columns. They are consumed once by buildSlotContext
    // during onboarding and their effects are baked into the prompt.
    // For the round-trip to work, these MUST be in niche_custom_variables.
    // This test reflects the ACTUAL round-trip path, not the onboarding path.
    {
      name: 'plumbing with owner phone + custom triage',
      intake: {
        niche: 'plumbing',
        business_name: 'Emon Plumbing',
        agent_name: 'Dave',
        city: 'Calgary NW',
        owner_name: 'Emon Ahmed',
        hours_weekday: 'Mon-Fri 7am-6pm',
        owner_phone: '+14035551234',
        // In the DB, forwarding_number is set from owner_phone during provisioning
        forwarding_number: '+14035551234',
        call_handling_mode: 'triage',
        niche_custom_variables: {
          TRIAGE_DEEP: 'Custom plumbing triage: ask about leak severity, water main status, and whether they have a shutoff valve.'
        },
      },
    },
    {
      name: 'hvac with pgvector + appointment_booking mode',
      intake: {
        niche: 'hvac',
        business_name: 'Prairie HVAC',
        agent_name: 'Sarah',
        city: 'Saskatoon',
        owner_name: 'Jim Prairie',
        hours_weekday: 'Mon-Sat 7am-7pm',
        call_handling_mode: 'triage',
        agent_mode: 'appointment_booking',
        knowledge_backend: 'pgvector',
        knowledge_chunk_count: 15,
        sms_enabled: true,
        // niche_emergency and niche_pricingModel are NOT DB columns
        // Their effects are baked into the prompt at onboarding
      },
    },
    {
      name: 'dental baseline (niche defaults only)',
      intake: {
        niche: 'dental',
        business_name: 'Bright Smiles Dental',
        agent_name: 'Lily',
        city: 'Edmonton',
        owner_name: 'Dr. Sarah Chen',
        hours_weekday: 'Mon-Thu 8am-5pm, Fri 8am-3pm',
        call_handling_mode: 'triage',
        // niche_newPatients, niche_insurance, niche_emergencyAppts are NOT DB columns
        // Round-trip only works with niche defaults + niche_custom_variables
      },
    },
    {
      name: 'property_management with forwarding + transfer',
      intake: {
        niche: 'property_management',
        business_name: 'Urban Vibe Properties',
        agent_name: 'Alisha',
        city: 'Calgary',
        owner_name: 'Ray Kassam',
        hours_weekday: 'Mon-Fri 9am-5pm',
        owner_phone: '+14035559999',
        call_handling_mode: 'triage',
        forwarding_number: '+14035559999',
        // niche_propertyType and niche_hasEmergencyLine are NOT DB columns
        // Their effects bake into the prompt at onboarding only
      },
    },
  ]

  for (const { name, intake } of NICHES_TO_TEST) {
    test(`round-trip: ${name}`, () => {
      // Path A: original intake → SlotContext → prompt
      const ctxA = buildSlotContext(intake)
      const promptA = buildPromptFromSlots(ctxA)

      // Path B: intake → simulated client row → back to intake → SlotContext → prompt
      const clientRow = intakeToSimulatedClientRow(intake)
      const recoveredIntake = clientRowToIntake(clientRow, (intake.knowledge_chunk_count as number) ?? 0)
      const ctxB = buildSlotContext(recoveredIntake)
      const promptB = buildPromptFromSlots(ctxB)

      // Core identity fields must match exactly
      assert.strictEqual(ctxA.agentName, ctxB.agentName, 'agentName mismatch')
      assert.strictEqual(ctxA.businessName, ctxB.businessName, 'businessName mismatch')
      assert.strictEqual(ctxA.closePerson, ctxB.closePerson, 'closePerson mismatch')
      assert.strictEqual(ctxA.industry, ctxB.industry, 'industry mismatch')

      // Flow fields must match
      assert.strictEqual(ctxA.primaryGoal, ctxB.primaryGoal, 'primaryGoal mismatch')
      assert.strictEqual(ctxA.effectiveMode, ctxB.effectiveMode, 'effectiveMode mismatch')
      assert.strictEqual(ctxA.transferEnabled, ctxB.transferEnabled, 'transferEnabled mismatch')

      // The full prompt should be identical
      assert.strictEqual(promptA, promptB, `Full prompt diverged for ${name}`)
    })
  }
})

describe('clientRowToIntake preserves niche_custom_variables', () => {
  test('TRIAGE_DEEP override survives round-trip', () => {
    const customTriage = 'Ask about the make and model first, then the specific problem.'
    const intake: Record<string, unknown> = {
      niche: 'auto_glass',
      business_name: 'Test Glass',
      agent_name: 'Alex',
      city: 'Calgary',
      call_handling_mode: 'triage',
      niche_custom_variables: { TRIAGE_DEEP: customTriage },
    }

    const ctx = buildSlotContext(intake)
    assert.ok(ctx.triageDeep.includes(customTriage), 'Custom TRIAGE_DEEP should be in context')

    // Round-trip
    const clientRow = intakeToSimulatedClientRow(intake)
    const recovered = clientRowToIntake(clientRow)
    const ctx2 = buildSlotContext(recovered)

    assert.strictEqual(ctx.triageDeep, ctx2.triageDeep, 'TRIAGE_DEEP should survive round-trip')
  })

  test('FORBIDDEN_EXTRA override survives round-trip', () => {
    const customForbidden = 'NEVER discuss competitor products.'
    const intake: Record<string, unknown> = {
      niche: 'hvac',
      business_name: 'Test HVAC',
      agent_name: 'Alex',
      city: 'Regina',
      call_handling_mode: 'triage',
      niche_custom_variables: { FORBIDDEN_EXTRA: customForbidden },
    }

    const ctx = buildSlotContext(intake)
    // Check that the forbidden extra rule made it into the rules
    const hasRule = ctx.forbiddenExtraRules.some(r => r.includes('NEVER discuss competitor'))
    assert.ok(hasRule, 'Custom FORBIDDEN_EXTRA should be in forbiddenExtraRules')

    // Round-trip
    const clientRow = intakeToSimulatedClientRow(intake)
    const recovered = clientRowToIntake(clientRow)
    const ctx2 = buildSlotContext(recovered)

    assert.deepStrictEqual(
      ctx.forbiddenExtraRules,
      ctx2.forbiddenExtraRules,
      'forbiddenExtraRules should survive round-trip',
    )
  })
})

describe('hasSlotMarkers guard', () => {
  test('slot-composed prompt has markers', () => {
    const intake = {
      niche: 'auto_glass',
      business_name: 'Test',
      agent_name: 'Alex',
      city: 'Calgary',
      call_handling_mode: 'triage',
    }
    const prompt = buildPromptFromSlots(buildSlotContext(intake))
    assert.ok(
      prompt.includes('<!-- unmissed:identity -->'),
      'Slot-composed prompt should have identity marker',
    )
    assert.ok(
      prompt.includes('<!-- unmissed:knowledge -->'),
      'Slot-composed prompt should have knowledge marker',
    )
  })
})
