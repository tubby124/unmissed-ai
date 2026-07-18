import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { auditTwilioUrls, auditPromptLength } from '../drift-detector.js'
import { PROMPT_CHAR_HARD_MAX } from '../knowledge-summary.js'

const SHARED_FALLBACK = 'https://fallback.endvoicemail.ai/voice'

function dimensions(findings: ReturnType<typeof auditTwilioUrls>): string[] {
  return findings.map(f => f.dimension)
}

describe('auditTwilioUrls', () => {
  test('accepts the intentional shared Cloudflare fallback without a client slug', () => {
    const findings = auditTwilioUrls('urban-vibe', {
      voiceUrl: 'https://endvoicemail.ai/api/webhook/urban-vibe/inbound',
      voiceFallbackUrl: SHARED_FALLBACK,
      smsUrl: 'https://endvoicemail.ai/api/webhook/urban-vibe/sms-inbound',
    })

    assert.deepEqual(findings, [])
  })

  test('flags a fallback on the wrong host or path once', () => {
    const findings = auditTwilioUrls('urban-vibe', {
      voiceUrl: 'https://endvoicemail.ai/api/webhook/urban-vibe/inbound',
      voiceFallbackUrl: 'https://wrong.example.com/voice',
      smsUrl: 'https://endvoicemail.ai/api/webhook/urban-vibe/sms-inbound',
    })

    assert.deepEqual(dimensions(findings), ['twilio_voice_fallback_url'])
    assert.equal(findings[0].expected, SHARED_FALLBACK)
  })

  test('flags a client-specific primary-app fallback route', () => {
    const findings = auditTwilioUrls('urban-vibe', {
      voiceUrl: 'https://endvoicemail.ai/api/webhook/urban-vibe/inbound',
      voiceFallbackUrl: 'https://endvoicemail.ai/api/webhook/urban-vibe/fallback',
      smsUrl: 'https://endvoicemail.ai/api/webhook/urban-vibe/sms-inbound',
    })

    assert.deepEqual(dimensions(findings), ['twilio_voice_fallback_url'])
  })

  test('flags a missing disaster fallback', () => {
    const findings = auditTwilioUrls('urban-vibe', {
      voiceUrl: 'https://endvoicemail.ai/api/webhook/urban-vibe/inbound',
      voiceFallbackUrl: null,
      smsUrl: 'https://endvoicemail.ai/api/webhook/urban-vibe/sms-inbound',
    })

    assert.deepEqual(dimensions(findings), ['twilio_voice_fallback_url'])
    assert.equal(findings[0].expected, SHARED_FALLBACK)
    assert.equal(findings[0].actual, '(empty)')
  })

  test('primary voice and SMS still require the canonical host and client slug', () => {
    const findings = auditTwilioUrls('urban-vibe', {
      voiceUrl: 'https://old.example.com/api/webhook/urban-vibe/inbound',
      voiceFallbackUrl: SHARED_FALLBACK,
      smsUrl: 'https://endvoicemail.ai/api/webhook/other-client/sms-inbound',
    })

    assert.deepEqual(dimensions(findings), [
      'twilio_voice_url_host',
      'twilio_sms_url_slug',
    ])
  })
})

describe('auditPromptLength', () => {
  test('accepts the shared runtime hard limit', () => {
    assert.deepEqual(auditPromptLength('urban-vibe', PROMPT_CHAR_HARD_MAX), [])
  })

  test('flags one character over the shared runtime hard limit', () => {
    const findings = auditPromptLength('urban-vibe', PROMPT_CHAR_HARD_MAX + 1)
    assert.equal(findings.length, 1)
    assert.equal(findings[0].dimension, 'prompt_length')
    assert.equal(findings[0].expected, `≤ ${PROMPT_CHAR_HARD_MAX} chars`)
  })
})
