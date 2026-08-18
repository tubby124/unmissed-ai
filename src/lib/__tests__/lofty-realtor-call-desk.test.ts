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

type RealtorCallDeskModule = {
  MAX_DEFAULT_OUTBOUND_SECONDS?: number
  normalizeCalgaryPlace?: (value: string) => string | null
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
    outcome: 'booked' | 'missed' | 'answered',
    config: {
      businessName: string
      agentName?: string | null
      callerName?: string | null
      appointmentTime?: string | null
      context?: 'realtor' | 'generic'
    }
  ) => string | null
}

async function loadRealtorCallDesk(): Promise<RealtorCallDeskModule> {
  try {
    const modulePath = '../lofty-realtor-call-desk.js'
    return await import(modulePath)
  } catch (error) {
    assert.fail(
      `Expected realtor outbound call desk utilities at src/lib/lofty-realtor-call-desk.ts: ${error instanceof Error ? error.message : String(error)}`
    )
  }
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
    assert.match(prompt, /Ask one question per turn/)
    assert.match(prompt, /one short check-in only/)
    assert.match(prompt, /Do not make price, listing, school, market, or availability claims/)
    assert.match(prompt, /Yes, I’m Hasan’s AI assistant\./)
    assert.match(prompt, /active_now, future_timeline, not_looking, wrong_number, do_not_call, no_answer, voicemail/)
    assert.doesNotMatch(prompt, /quick minute/i)
    assert.doesNotMatch(prompt, /flirty|busty/i)
  })

  it('resolves Lofty realtor mode only from structured numeric lead metadata', async () => {
    const { resolveRealtorLeadContext } = await loadRealtorOutboundPrompt()

    assert.deepEqual(resolveRealtorLeadContext({
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

    assert.equal(resolveRealtorLeadContext({ source: 'lofty_buyer_revival', externalRef: 'not-a-number' }), null)
    assert.equal(resolveRealtorLeadContext({ source: 'generic_campaign', externalRef: '987654321' }), null)
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

  it('normalizes a valid Calgary community without classifier drift', async () => {
    const { normalizeCalgaryPlace } = await loadRealtorCallDesk()
    assert.equal(typeof normalizeCalgaryPlace, 'function')
    assert.equal(normalizeCalgaryPlace!('Bowness'), 'Bowness')
  })

  it('rejects corrupted Calgary place tokens from the self-test', async () => {
    const { normalizeCalgaryPlace } = await loadRealtorCallDesk()
    assert.equal(typeof normalizeCalgaryPlace, 'function')
    for (const token of baseline.classifierCorruptionTokens) {
      assert.equal(normalizeCalgaryPlace!(token), null, `${token} must not normalize to ${baseline.intendedArea}`)
    }
  })

  it('does not send missed-call SMS for realtor outbound Lofty leads', async () => {
    const { getOutboundLeadSmsTemplate } = await loadSmsTemplates()
    assert.equal(typeof getOutboundLeadSmsTemplate, 'function')
    assert.equal(
      getOutboundLeadSmsTemplate!('missed', {
        businessName: 'Realtor office',
        agentName: 'Aisha',
        context: 'realtor',
      }),
      null
    )
  })
})
