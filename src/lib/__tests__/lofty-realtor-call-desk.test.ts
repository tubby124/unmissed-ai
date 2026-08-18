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
    return await import('../lofty-realtor-call-desk.js')
  } catch (error) {
    assert.fail(
      `Expected realtor outbound call desk utilities at src/lib/lofty-realtor-call-desk.ts: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

async function loadSmsTemplates(): Promise<SmsTemplatesModule> {
  return await import('../sms-templates.js')
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
    const { MAX_DEFAULT_OUTBOUND_SECONDS } = await loadRealtorCallDesk()
    assert.equal(typeof MAX_DEFAULT_OUTBOUND_SECONDS, 'number')
    assert.ok(
      MAX_DEFAULT_OUTBOUND_SECONDS! <= 75,
      `default outbound cap must be <=75s; self-test lasted ${baseline.durationSeconds}s`
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
