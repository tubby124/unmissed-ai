import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fixtureUrl = new URL('./fixtures/hasan-lofty-self-test.json', import.meta.url)
const baseline = JSON.parse(readFileSync(fixtureUrl, 'utf8')) as {
  durationSeconds: number
  turnCount: number
  intendedArea: string
  source: string
  classifierCorruptionTokens: string[]
}

type CalgaryPlaceNormalizationModule = {
  BOWNESS_CLARIFICATION_QUESTION: string
  buildCalgaryPlaceEvidence: (value?: string | null) => {
    raw: string | null
    canonicalArea: string | null
    needsConfirmation: boolean
    spokenClarification: string | null
    pronunciationHints: string[]
  }
  extractCalgaryPlaceEvidenceFromTranscript: (transcriptText: string) => {
    raw: string | null
    canonicalArea: string | null
    needsConfirmation: boolean
    spokenClarification: string | null
    pronunciationHints: string[]
  }
  normalizeCalgaryPlace: (value: string) => string | null
}

type RealtorOutboundPromptModule = {
  MAX_DEFAULT_OUTBOUND_SECONDS: number
  REALTOR_LOFTY_REVIVAL_MODE: 'realtor_lofty_revival'
  buildRealtorOutboundPrompt: (context: {
    loftyLeadId: string
    name: string
    source?: string
    pipelineStage?: string
    rawArea?: string
    pronunciationHints?: string[]
    priorAttempts: number
  }) => string
  resolveRealtorLeadContext: (input: {
    clientSlug?: string | null
    clientNiche?: string | null
    name?: string | null
    source?: string | null
    externalRef?: string | number | null
    pipelineStage?: string | null
    priorAttempts?: number | null
  }) => {
    loftyLeadId: string
    name: string
    source?: string
    pipelineStage?: string
    priorAttempts: number
  } | null
}

type OutboundPromptBuilderModule = {
  resolveOutboundPrompt: (template: string, vars: {
    leadName: string
    leadPhone: string
    leadNotes: string
    businessName: string
    agentName: string
  }) => string
}

type SmsTemplatesModule = {
  getOutboundLeadSmsTemplate?: (
    outcome: 'booked' | 'missed' | 'answered' | 'not_looking' | 'wrong_number' | 'do_not_call' | 'requested_listing',
    config: {
      businessName: string
      agentName?: string | null
      callerName?: string | null
      appointmentTime?: string | null
      campaignType?: 'realtor_lofty_revival' | 'generic'
      sendMissedCallText?: boolean
      verifiedSearchUrl?: string | null
      verifiedSearchName?: string | null
    }
  ) => string | null
}

async function loadCalgaryPlaceNormalization(): Promise<CalgaryPlaceNormalizationModule> {
  return await import('../calgary-place-normalization.js')
}

async function loadSmsTemplates(): Promise<SmsTemplatesModule> {
  return await import('../sms-templates.js')
}

async function loadRealtorOutboundPrompt(): Promise<RealtorOutboundPromptModule> {
  return await import('../realtor-outbound-prompt.js')
}

async function loadOutboundPromptBuilder(): Promise<OutboundPromptBuilderModule> {
  return await import('../outbound-prompt-builder.js')
}

describe('Lofty/Aisha redacted outbound self-test baseline', () => {
  it('preserves only operational facts from the self-test', () => {
    assert.deepEqual(Object.keys(baseline).sort(), [
      'classifierCorruptionTokens',
      'durationSeconds',
      'intendedArea',
      'source',
      'turnCount',
    ])
    assert.equal(baseline.durationSeconds, 125)
    assert.equal(baseline.turnCount, 18)
    assert.equal(baseline.intendedArea, 'Bowness')
    assert.equal(baseline.source, 'outbound_lofty_simulation')
    assert.deepEqual(baseline.classifierCorruptionTokens, ['Bonita', 'Bonas'])

    const serialized = JSON.stringify(baseline)
    assert.doesNotMatch(serialized, /transcript|recording|recordingUrl|client|clientId|phone|email|lead|name|url/i)
  })
})

describe('Lofty/Aisha realtor outbound call desk contract', () => {
  it('caps default outbound calls at 75 seconds or less', async () => {
    const { MAX_DEFAULT_OUTBOUND_SECONDS } = await loadRealtorOutboundPrompt()
    assert.equal(typeof MAX_DEFAULT_OUTBOUND_SECONDS, 'number')
    assert.ok(
      MAX_DEFAULT_OUTBOUND_SECONDS! <= 75,
      `default outbound cap must be <=75s; self-test lasted ${baseline.durationSeconds}s`
    )
  })

  it('builds the explicit concise realtor_lofty_revival prompt contract', async () => {
    const { REALTOR_LOFTY_REVIVAL_MODE, buildRealtorOutboundPrompt } = await loadRealtorOutboundPrompt()
    assert.equal(REALTOR_LOFTY_REVIVAL_MODE, 'realtor_lofty_revival')

    const prompt = buildRealtorOutboundPrompt({
      loftyLeadId: '123456789012345',
      name: 'Birhanu Example',
      source: 'outbound_lofty_simulation',
      pipelineStage: 'revival',
      rawArea: 'Bowness',
      pronunciationHints: ['Bowness = BOH-ness'],
      priorAttempts: 1,
    })

    assert.match(prompt, /Call mode: realtor_lofty_revival/)
    assert.match(prompt, /within 12 seconds/)
    assert.match(prompt, /Ask at most three qualification questions total/)
    assert.match(prompt, /Maximum one agent turn is 10 seconds/)
    assert.match(prompt, /ONE QUESTION PER TURN/)
    assert.match(prompt, /one short check-in only/)
    assert.match(prompt, /Do not make price, listing, school, market, or availability claims/)
    assert.match(prompt, /Yes, I’m Hasan’s AI assistant\./)
    assert.match(prompt, /active_now, future_timeline, not_looking, wrong_number, do_not_call, no_answer, voicemail/)
    assert.doesNotMatch(prompt, /quick minute/i)
    assert.doesNotMatch(prompt, /flirty|busty/i)
  })

  it('resolves Lofty realtor mode only from strict Hasan real-estate structured numeric lead metadata', async () => {
    const { resolveRealtorLeadContext } = await loadRealtorOutboundPrompt()

    assert.deepEqual(resolveRealtorLeadContext({
      clientSlug: 'hasan-sharif',
      clientNiche: 'real_estate',
      name: 'Birhanu Example',
      source: 'lofty_buyer_revival',
      externalRef: '987654321',
      pipelineStage: 'revival',
      priorAttempts: 2,
    }), {
      loftyLeadId: '987654321',
      name: 'Birhanu Example',
      source: 'lofty_buyer_revival',
      pipelineStage: 'revival',
      priorAttempts: 2,
    })

    assert.equal(resolveRealtorLeadContext({
      clientSlug: 'hasan-sharif',
      clientNiche: 'real_estate',
      source: 'lofty_buyer_revival',
      externalRef: 'not-a-number',
    }), null)
    assert.equal(resolveRealtorLeadContext({
      clientSlug: 'hasan-sharif',
      clientNiche: 'real_estate',
      source: 'generic_campaign',
      externalRef: '987654321',
    }), null)
    assert.equal(resolveRealtorLeadContext({
      clientNiche: 'real_estate',
      source: 'lofty_buyer_revival',
      externalRef: '987654321',
    }), null)
    assert.equal(resolveRealtorLeadContext({
      clientSlug: 'wrong-client',
      clientNiche: 'real_estate',
      source: 'lofty_buyer_revival',
      externalRef: '987654321',
    }), null)
    assert.equal(resolveRealtorLeadContext({
      clientSlug: 'hasan-sharif',
      clientNiche: 'voicemail',
      source: 'lofty_buyer_revival',
      externalRef: '987654321',
    }), null)
    // Negative source gating: substring matches must NOT trigger realtor mode.
    // Allow-list only — not_lofty / non-lofty-import / lofty_backup stay generic.
    for (const badSource of ['not_lofty', 'non-lofty-import', 'lofty_backup', 'unrelated', '']) {
      assert.equal(resolveRealtorLeadContext({
        clientSlug: 'hasan-sharif',
        clientNiche: 'real_estate',
        source: badSource,
        externalRef: '987654321',
      }), null, `source ${JSON.stringify(badSource)} must not resolve`)
    }
  })

  it('uses the exact caller-respectful opener with current lead placeholder resolution', async () => {
    const { buildRealtorOutboundPrompt } = await loadRealtorOutboundPrompt()
    const { resolveOutboundPrompt } = await loadOutboundPromptBuilder()
    const prompt = resolveOutboundPrompt(buildRealtorOutboundPrompt({
      loftyLeadId: '123456',
      name: 'Birhanu Example',
      priorAttempts: 0,
    }), {
      leadName: 'Birhanu Example',
      leadPhone: '+15555550100',
      leadNotes: '',
      businessName: 'Hasan Sharif',
      agentName: 'Aisha',
    })

    assert.match(
      prompt,
      /Hi Birhanu, it’s Aisha calling for Hasan Sharif with eXp Realty\. You had looked at homes with us before—are you still considering a move, or should I close the loop\?/
    )
  })

  it('normalizes only the approved Bowness Calgary community without classifier drift', async () => {
    const { normalizeCalgaryPlace, buildCalgaryPlaceEvidence } = await loadCalgaryPlaceNormalization()
    assert.equal(normalizeCalgaryPlace('Bowness'), 'Bowness')
    assert.equal(normalizeCalgaryPlace('  bowness  '), 'Bowness')
    assert.equal(normalizeCalgaryPlace('BOWNESS'), 'Bowness')

    assert.deepEqual(buildCalgaryPlaceEvidence('Bowness'), {
      raw: 'Bowness',
      canonicalArea: 'Bowness',
      needsConfirmation: false,
      spokenClarification: null,
      pronunciationHints: ['Bowness = BOH-ness'],
    })
  })

  it('keeps corrupted or unmatched Calgary place tokens raw and confirmation-only', async () => {
    const { BOWNESS_CLARIFICATION_QUESTION, normalizeCalgaryPlace, buildCalgaryPlaceEvidence } = await loadCalgaryPlaceNormalization()
    assert.equal(BOWNESS_CLARIFICATION_QUESTION, 'Just to confirm, did you mean Bowness (BOH-ness), or somewhere else?')
    for (const token of baseline.classifierCorruptionTokens) {
      assert.equal(normalizeCalgaryPlace(token), null, `${token} must not normalize to ${baseline.intendedArea}`)
      assert.deepEqual(buildCalgaryPlaceEvidence(token), {
        raw: token,
        canonicalArea: null,
        needsConfirmation: true,
        spokenClarification: BOWNESS_CLARIFICATION_QUESTION,
        pronunciationHints: [],
      })
    }
    assert.equal(normalizeCalgaryPlace('Bowness Heights'), null)
    assert.equal(normalizeCalgaryPlace(''), null)
    assert.deepEqual(buildCalgaryPlaceEvidence('  Somewhere Else  '), {
      raw: 'Somewhere Else',
      canonicalArea: null,
      needsConfirmation: true,
      spokenClarification: BOWNESS_CLARIFICATION_QUESTION,
      pronunciationHints: [],
    })
  })

  it('uses Bowness pronunciation only for canonical Bowness and asks exact area clarification otherwise', async () => {
    const { BOWNESS_CLARIFICATION_QUESTION } = await loadCalgaryPlaceNormalization()
    const { buildRealtorOutboundPrompt } = await loadRealtorOutboundPrompt()

    const bownessPrompt = buildRealtorOutboundPrompt({
      loftyLeadId: '123456789012345',
      name: 'Birhanu Example',
      rawArea: 'Bowness',
      priorAttempts: 1,
    })
    assert.match(bownessPrompt, /Canonical approved area: Bowness/)
    assert.match(bownessPrompt, /Pronunciation hints: Bowness = BOH-ness/)
    assert.doesNotMatch(bownessPrompt, /Area confirmation required: yes/)

    const corruptedPrompt = buildRealtorOutboundPrompt({
      loftyLeadId: '123456789012345',
      name: 'Birhanu Example',
      rawArea: 'Bonita',
      pronunciationHints: ['Bonita = BOH-ness'],
      priorAttempts: 1,
    })
    assert.match(corruptedPrompt, /Raw area from source \(verbatim evidence only\): Bonita/)
    assert.match(corruptedPrompt, /Canonical approved area: none/)
    assert.match(corruptedPrompt, /Area confirmation required: yes/)
    assert.ok(corruptedPrompt.includes(BOWNESS_CLARIFICATION_QUESTION))
    assert.doesNotMatch(corruptedPrompt, /Bonita = BOH-ness/)
  })

  it('extracts only raw transcript place evidence and does not canonicalize drift tokens', async () => {
    const { extractCalgaryPlaceEvidenceFromTranscript } = await loadCalgaryPlaceNormalization()

    assert.deepEqual(extractCalgaryPlaceEvidenceFromTranscript('Caller said they were looking around Bonas.'), {
      raw: 'Bonas',
      canonicalArea: null,
      needsConfirmation: true,
      spokenClarification: 'Just to confirm, did you mean Bowness (BOH-ness), or somewhere else?',
      pronunciationHints: [],
    })
    assert.deepEqual(extractCalgaryPlaceEvidenceFromTranscript('Caller mentioned Bowness Heights as the area.'), {
      raw: 'Bowness Heights',
      canonicalArea: null,
      needsConfirmation: true,
      spokenClarification: 'Just to confirm, did you mean Bowness (BOH-ness), or somewhere else?',
      pronunciationHints: [],
    })
    assert.deepEqual(extractCalgaryPlaceEvidenceFromTranscript('Caller confirmed Bowness.'), {
      raw: 'Bowness',
      canonicalArea: 'Bowness',
      needsConfirmation: false,
      spokenClarification: null,
      pronunciationHints: ['Bowness = BOH-ness'],
    })
  })

  it('completed webhook keeps realtor transcript evidence separate from CRM/writeback areas', () => {
    const route = readFileSync(new URL('../../app/api/webhook/[slug]/completed/route.ts', import.meta.url), 'utf8')
    assert.match(route, /extractCalgaryPlaceEvidenceFromTranscript\(transcriptRawText\)/)
    assert.match(route, /serviceRequested = isRealtorLoftyCall \? null/)
    assert.match(route, /place_evidence:/)
    assert.match(route, /raw_transcript_area: realtorTranscriptPlaceEvidence\.raw/)
    assert.match(route, /canonical_crm_area: realtorTranscriptPlaceEvidence\.canonicalArea/)
    assert.doesNotMatch(route, /area:\s*classification/)
    assert.doesNotMatch(route, /canonical_crm_area:\s*classification/)
  })

  it('does not send missed-call SMS for realtor outbound Lofty leads', async () => {
    const { getOutboundLeadSmsTemplate } = await loadSmsTemplates()
    assert.equal(typeof getOutboundLeadSmsTemplate, 'function')
    assert.equal(
      getOutboundLeadSmsTemplate!('missed', {
        businessName: 'Realtor office',
        agentName: 'Aisha',
        campaignType: 'realtor_lofty_revival',
      }),
      null
    )
  })

  it('uses only explicit opt-in truthful no-answer copy for realtor Lofty revival', async () => {
    const { getOutboundLeadSmsTemplate } = await loadSmsTemplates()
    const body = getOutboundLeadSmsTemplate!('missed', {
      businessName: 'Realtor office',
      agentName: 'Aisha',
      callerName: 'Birhanu Example',
      campaignType: 'realtor_lofty_revival',
      sendMissedCallText: true,
    })
    assert.equal(
      body,
      'Hi Birhanu, Aisha called for Hasan Sharif with eXp Realty about your home search. No rush—reply here if you’re still planning a move, or reply STOP to opt out.'
    )
    assert.doesNotMatch(body!, /Thanks for calling|home list just landed/i)
  })

  it('requires actual callback time before realtor confirmation SMS', async () => {
    const { getOutboundLeadSmsTemplate } = await loadSmsTemplates()
    assert.equal(getOutboundLeadSmsTemplate!('booked', {
      businessName: 'Realtor office',
      agentName: 'Aisha',
      callerName: 'Birhanu Example',
      campaignType: 'realtor_lofty_revival',
    }), null)

    const body = getOutboundLeadSmsTemplate!('booked', {
      businessName: 'Realtor office',
      agentName: 'Aisha',
      callerName: 'Birhanu Example',
      appointmentTime: 'Friday at 3 PM',
      campaignType: 'realtor_lofty_revival',
    })
    assert.match(body!, /confirming your requested callback for Friday at 3 PM/i)
    assert.doesNotMatch(body!, /Thanks for calling|home list just landed/i)
  })

  it('suppresses realtor DNC wrong-number and not-looking dispositions', async () => {
    const { getOutboundLeadSmsTemplate } = await loadSmsTemplates()
    for (const outcome of ['do_not_call', 'wrong_number', 'not_looking'] as const) {
      assert.equal(getOutboundLeadSmsTemplate!(outcome, {
        businessName: 'Realtor office',
        agentName: 'Aisha',
        campaignType: 'realtor_lofty_revival',
      }), null)
    }
  })
})
