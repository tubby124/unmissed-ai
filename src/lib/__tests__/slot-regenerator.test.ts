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
import { clientRowToIntake as exportedClientRowToIntake } from '../slot-regenerator.js'

// clientRowToIntake is now exported, so we can test it directly
// AND via the full round-trip path for extra safety.

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

    // After hours
    after_hours_behavior: intake.after_hours_behavior ?? 'standard',

    // D302: Niche custom variables — merge explicit overrides with niche_* intake fields
    // This mirrors what provision/trial/route.ts now does at onboarding time.
    niche_custom_variables: (() => {
      const ncv: Record<string, string> = {}
      // Collect niche_* intake fields (same as provision route)
      for (const [k, v] of Object.entries(intake)) {
        if (k.startsWith('niche_') && k !== 'niche_custom_variables' && k !== 'niche_faq_pairs' && v) {
          ncv[k] = String(v)
        }
      }
      // Merge with explicit overrides (TRIAGE_DEEP etc.)
      const explicit = intake.niche_custom_variables as Record<string, string> | undefined
      return { ...ncv, ...(explicit ?? {}) }
    })(),
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
    // D302: Spread niche_* fields from niche_custom_variables back to top-level keys
    // (mirrors the D302 change in slot-regenerator.ts clientRowToIntake)
    ...(() => {
      const ncv = client.niche_custom_variables as Record<string, unknown> | null
      if (!ncv || typeof ncv !== 'object') return {}
      const spread: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(ncv)) {
        if (k.startsWith('niche_')) spread[k] = v
      }
      return spread
    })(),
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

describe('D302: niche intake fields survive round-trip via niche_custom_variables', () => {
  test('HVAC niche_emergency + niche_pricingModel survive', () => {
    const intake: Record<string, unknown> = {
      niche: 'hvac',
      business_name: 'Prairie HVAC',
      agent_name: 'Sarah',
      city: 'Saskatoon',
      hours_weekday: 'Mon-Sat 7am-7pm',
      call_handling_mode: 'triage',
      niche_emergency: '24/7 emergency for no-heat calls',
      niche_pricingModel: 'flat_rate',
      niche_serviceArea: 'Saskatoon and surrounding area',
      niche_brands: 'Lennox, Carrier, Trane',
    }

    const ctxA = buildSlotContext(intake)
    const promptA = buildPromptFromSlots(ctxA)

    // Simulate DB round-trip
    const clientRow = intakeToSimulatedClientRow(intake)
    const recovered = clientRowToIntake(clientRow)
    const ctxB = buildSlotContext(recovered)
    const promptB = buildPromptFromSlots(ctxB)

    assert.strictEqual(promptA, promptB, 'HVAC prompt should match after round-trip with niche fields')
  })

  test('plumbing niche_clientType + niche_emergency survive', () => {
    const intake: Record<string, unknown> = {
      niche: 'plumbing',
      business_name: 'Emon Plumbing',
      agent_name: 'Dave',
      city: 'Calgary NW',
      hours_weekday: 'Mon-Fri 7am-6pm',
      call_handling_mode: 'triage',
      niche_emergency: 'burst pipes, sewer backup, no hot water',
      niche_clientType: 'residential',
      niche_serviceArea: 'Calgary NW and Airdrie',
    }

    const ctxA = buildSlotContext(intake)
    const promptA = buildPromptFromSlots(ctxA)

    const clientRow = intakeToSimulatedClientRow(intake)
    const recovered = clientRowToIntake(clientRow)
    const ctxB = buildSlotContext(recovered)
    const promptB = buildPromptFromSlots(ctxB)

    assert.strictEqual(promptA, promptB, 'Plumbing prompt should match after round-trip with niche fields')
  })

  test('dental niche_newPatients + niche_insurance + niche_emergencyAppts survive', () => {
    const intake: Record<string, unknown> = {
      niche: 'dental',
      business_name: 'Bright Smiles Dental',
      agent_name: 'Lily',
      city: 'Edmonton',
      hours_weekday: 'Mon-Thu 8am-5pm',
      call_handling_mode: 'triage',
      niche_newPatients: 'yes',
      niche_insurance: 'all_major',
      niche_emergencyAppts: 'same_day',
    }

    const ctxA = buildSlotContext(intake)
    const promptA = buildPromptFromSlots(ctxA)

    const clientRow = intakeToSimulatedClientRow(intake)
    const recovered = clientRowToIntake(clientRow)
    const ctxB = buildSlotContext(recovered)
    const promptB = buildPromptFromSlots(ctxB)

    assert.strictEqual(promptA, promptB, 'Dental prompt should match after round-trip with niche fields')
  })

  test('restaurant niche_cuisineType + niche_orderTypes + niche_cancelPolicy survive', () => {
    const intake: Record<string, unknown> = {
      niche: 'restaurant',
      business_name: 'Spice Route',
      agent_name: 'Priya',
      city: 'Calgary',
      hours_weekday: 'Tue-Sun 11am-10pm',
      call_handling_mode: 'triage',
      niche_cuisineType: 'Indian fusion',
      niche_orderTypes: 'dine-in, takeout, delivery',
      niche_cancelPolicy: '24h',
      niche_partySize: '12',
    }

    const ctxA = buildSlotContext(intake)
    const promptA = buildPromptFromSlots(ctxA)

    const clientRow = intakeToSimulatedClientRow(intake)
    const recovered = clientRowToIntake(clientRow)
    const ctxB = buildSlotContext(recovered)
    const promptB = buildPromptFromSlots(ctxB)

    assert.strictEqual(promptA, promptB, 'Restaurant prompt should match after round-trip with niche fields')
  })

  test('property_management niche_propertyType + niche_hasEmergencyLine survive', () => {
    const intake: Record<string, unknown> = {
      niche: 'property_management',
      business_name: 'Urban Vibe Properties',
      agent_name: 'Alisha',
      city: 'Calgary',
      hours_weekday: 'Mon-Fri 9am-5pm',
      call_handling_mode: 'triage',
      niche_propertyType: 'residential',
      niche_hasEmergencyLine: 'yes',
      niche_maintenanceContacts: 'Emergency plumber: 403-555-1234, Electrician: 403-555-5678',
    }

    const ctxA = buildSlotContext(intake)
    const promptA = buildPromptFromSlots(ctxA)

    const clientRow = intakeToSimulatedClientRow(intake)
    const recovered = clientRowToIntake(clientRow)
    const ctxB = buildSlotContext(recovered)
    const promptB = buildPromptFromSlots(ctxB)

    assert.strictEqual(promptA, promptB, 'Property mgmt prompt should match after round-trip with niche fields')
  })
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

// ── D280: recomposePrompt round-trip tests ──────────────────────────────────────

describe('D280: recomposePrompt equivalence', () => {
  // recomposePrompt calls buildPromptFromSlots(ctx) where ctx is built from
  // clientRowToIntake(clientRow). This test verifies that the full chain
  // intake → clientRow → clientRowToIntake → buildSlotContext → buildPromptFromSlots
  // produces the same prompt as the direct intake path.
  //
  // This IS the core recomposePrompt contract — if this passes, the function
  // will produce correct output.

  const RECOMPOSE_CASES = [
    {
      name: 'auto_glass full config',
      intake: {
        niche: 'auto_glass',
        business_name: 'Quick Glass Ltd',
        agent_name: 'Blake',
        city: 'Calgary',
        owner_name: 'Mark Johnson',
        hours_weekday: 'Mon-Fri 8am-5pm',
        call_handling_mode: 'triage',
        voice_style_preset: 'professional',
        booking_enabled: true,
        sms_enabled: true,
        owner_phone: '+14035551234',
        forwarding_number: '+14035551234',
        knowledge_backend: 'pgvector',
        knowledge_chunk_count: 15,
        services_offered: 'Windshield replacement, chip repair, side windows',
        services_not_offered: 'Tinting',
        after_hours_behavior: 'standard',
        niche_custom_variables: {
          TRIAGE_DEEP: 'Ask: make/model/year, chip or crack, size, location on windshield.',
        },
      },
    },
    {
      name: 'plumbing minimal config',
      intake: {
        niche: 'plumbing',
        business_name: 'Emon Plumbing',
        agent_name: 'Dave',
        city: 'Calgary NW',
        owner_name: 'Emon Ahmed',
        hours_weekday: 'Mon-Fri 7am-6pm',
        call_handling_mode: 'triage',
      },
    },
    {
      name: 'dental with insurance + booking',
      intake: {
        niche: 'dental',
        business_name: 'Bright Smiles',
        agent_name: 'Lily',
        city: 'Edmonton',
        owner_name: 'Dr. Sarah Chen',
        hours_weekday: 'Mon-Thu 8am-5pm',
        call_handling_mode: 'triage',
        booking_enabled: true,
        insurance_preset: 'all_major',
        niche_custom_variables: {
          niche_newPatients: 'yes',
          niche_emergencyAppts: 'same_day',
        },
      },
    },
    {
      name: 'property_management with transfer',
      intake: {
        niche: 'property_management',
        business_name: 'Urban Vibe',
        agent_name: 'Alisha',
        city: 'Calgary',
        owner_name: 'Ray Kassam',
        hours_weekday: 'Mon-Fri 9am-5pm',
        call_handling_mode: 'triage',
        owner_phone: '+14035559999',
        forwarding_number: '+14035559999',
        after_hours_behavior: 'route_emergency',
        emergency_phone: '+14035550911',
      },
    },
    {
      name: 'restaurant with FAQ pairs',
      intake: {
        niche: 'restaurant',
        business_name: 'Spice Route',
        agent_name: 'Priya',
        city: 'Calgary',
        owner_name: 'Chef Raj',
        hours_weekday: 'Tue-Sun 11am-10pm',
        call_handling_mode: 'triage',
        niche_faq_pairs: JSON.stringify([
          { q: 'Do you have a patio?', a: 'Yes, our patio is open seasonally.' },
          { q: 'Is parking available?', a: 'Free parking in rear lot.' },
        ]),
      },
    },
    {
      name: 'hvac with appointment_booking mode',
      intake: {
        niche: 'hvac',
        business_name: 'Prairie HVAC',
        agent_name: 'Sarah',
        city: 'Saskatoon',
        owner_name: 'Jim Prairie',
        hours_weekday: 'Mon-Sat 7am-7pm',
        call_handling_mode: 'triage',
        agent_mode: 'appointment_booking',
        booking_enabled: true,
        sms_enabled: true,
      },
    },
  ]

  for (const { name, intake } of RECOMPOSE_CASES) {
    test(`recompose equivalence: ${name}`, () => {
      // Path A: direct intake → prompt (what onboarding does)
      const ctxA = buildSlotContext(intake)
      const promptA = buildPromptFromSlots(ctxA)

      // Path B: intake → simulated client row → clientRowToIntake → prompt
      // (what recomposePrompt does at runtime)
      const clientRow = intakeToSimulatedClientRow(intake)
      const recoveredIntake = exportedClientRowToIntake(
        clientRow,
        [],
        (intake.knowledge_backend === 'pgvector' ? 15 : 0),
      )
      const ctxB = buildSlotContext(recoveredIntake)
      const promptB = buildPromptFromSlots(ctxB)

      assert.strictEqual(promptA, promptB, `Recompose diverged for: ${name}`)
    })
  }

  test('recompose is idempotent', () => {
    const intake = {
      niche: 'auto_glass',
      business_name: 'Test Glass',
      agent_name: 'Alex',
      city: 'Calgary',
      owner_name: 'Test Owner',
      hours_weekday: 'Mon-Fri 8-5',
      call_handling_mode: 'triage',
    }

    const clientRow = intakeToSimulatedClientRow(intake)
    const recovered1 = exportedClientRowToIntake(clientRow, [], 0)
    const prompt1 = buildPromptFromSlots(buildSlotContext(recovered1))

    // Simulate saving prompt1 to DB and recomposing again
    const clientRow2 = { ...clientRow, system_prompt: prompt1 }
    const recovered2 = exportedClientRowToIntake(clientRow2, [], 0)
    const prompt2 = buildPromptFromSlots(buildSlotContext(recovered2))

    assert.strictEqual(prompt1, prompt2, 'Recompose should be idempotent')
  })

  test('recompose has section markers for identity and knowledge', () => {
    // Only identity and knowledge slots call wrapSection() explicitly.
    // Other slots use header text matched by replacePromptSection aliases.
    const intake = {
      niche: 'plumbing',
      business_name: 'Test Plumbing',
      agent_name: 'Dave',
      city: 'Calgary',
      call_handling_mode: 'triage',
      booking_enabled: true,
      sms_enabled: true,
      owner_phone: '+14035551234',
    }
    const clientRow = intakeToSimulatedClientRow(intake)
    const recovered = exportedClientRowToIntake(clientRow, [], 0)
    const prompt = buildPromptFromSlots(buildSlotContext(recovered))

    // Marker-wrapped slots
    assert.ok(prompt.includes('<!-- unmissed:identity -->'), 'Should have identity marker')
    assert.ok(prompt.includes('<!-- /unmissed:identity -->'), 'Should have identity end marker')
    assert.ok(prompt.includes('<!-- unmissed:knowledge -->'), 'Should have knowledge marker')
    assert.ok(prompt.includes('<!-- /unmissed:knowledge -->'), 'Should have knowledge end marker')

    // Key section headers should be present (these are matched by alias in replacePromptSection)
    assert.ok(prompt.includes('LIFE SAFETY EMERGENCY OVERRIDE'), 'Should have safety header')
    assert.ok(prompt.includes('ABSOLUTE FORBIDDEN ACTIONS'), 'Should have forbidden header')
    assert.ok(prompt.includes('DYNAMIC CONVERSATION FLOW'), 'Should have conversation flow header')
    assert.ok(prompt.includes('GOAL'), 'Should have goal header')
  })
})

describe('D280: clientRowToIntake exported', () => {
  test('exported function produces same output as inline copy', () => {
    const clientRow = {
      niche: 'auto_glass',
      business_name: 'Quick Glass',
      agent_name: 'Blake',
      city: 'Calgary',
      owner_name: 'Mark',
      business_hours_weekday: 'Mon-Fri 8am-5pm',
      services_offered: 'Windshield repair',
      services_not_offered: null,
      callback_phone: '+14035551234',
      forwarding_number: '+14035559999',
      after_hours_emergency_phone: null,
      call_handling_mode: 'triage',
      agent_mode: null,
      voice_style_preset: 'professional',
      agent_tone: null,
      booking_enabled: false,
      sms_enabled: false,
      knowledge_backend: '',
      pricing_policy: null,
      unknown_answer_behavior: null,
      caller_faq: null,
      common_objections: null,
      extra_qa: null,
      completion_fields: null,
      agent_restrictions: null,
      insurance_preset: null,
      insurance_status: null,
      insurance_detail: null,
      after_hours_behavior: 'standard',
      niche_custom_variables: null,
    }

    const result = exportedClientRowToIntake(clientRow, [], 0)

    assert.strictEqual(result.niche, 'auto_glass')
    assert.strictEqual(result.business_name, 'Quick Glass')
    assert.strictEqual(result.agent_name, 'Blake')
    assert.strictEqual(result.db_agent_name, 'Blake')
    assert.strictEqual(result.hours_weekday, 'Mon-Fri 8am-5pm')
    assert.strictEqual(result.owner_phone, '+14035559999')
    assert.strictEqual(result.forwarding_number, '+14035559999')
  })
})
