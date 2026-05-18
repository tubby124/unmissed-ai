import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { generateNicheConfig } from '@/lib/niche-generator'

const PROJECT_ROOT = process.cwd()

test('custom other-niche generation includes manual business description when no GBP or website exists', async () => {
  const originalKey = process.env.OPENROUTER_API_KEY
  const originalFetch = global.fetch
  process.env.OPENROUTER_API_KEY = 'test-openrouter-key'

  let capturedBody: unknown = null
  global.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            industry: 'call answering',
            primary_call_reason: 'after hours call handling',
            triage_deep: 'HOT = urgent caller. WARM = callback requested. COLD = info only. JUNK = spam.',
            info_to_collect: 'name, phone, reason for call',
            faq_defaults: ['Q — A'],
            classification_rule: 'HOT = urgent, WARM = callback, COLD = info, JUNK = spam.',
            close_person: 'our team',
            close_action: 'call you back',
          }),
        },
      }],
    }), { status: 200 })
  }

  try {
    await generateNicheConfig(
      'Qazvornix Call Desk',
      '',
      '',
      '',
      '',
      'We answer phones after hours for unusual custom service businesses.'
    )
  } finally {
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = originalKey
    global.fetch = originalFetch
  }

  assert.ok(capturedBody && typeof capturedBody === 'object')
  const body = capturedBody as { messages: Array<{ role: string; content: string }> }
  const userPrompt = body.messages.find((message) => message.role === 'user')?.content ?? ''

  assert.match(
    userPrompt,
    /Manual Business Description: We answer phones after hours for unusual custom service businesses\./
  )
})

test('trial provisioning passes manual description into custom other-niche generation', () => {
  const route = fs.readFileSync(
    path.join(PROJECT_ROOT, 'src/app/api/provision/trial/route.ts'),
    'utf-8'
  )
  const callStart = route.indexOf('customNicheConfig = await generateNicheConfig(')
  assert.ok(callStart > -1, 'expected trial provisioning to call generateNicheConfig')
  const callBody = route.slice(callStart, route.indexOf(')', callStart) + 1)

  assert.match(callBody, /data\.manualDescription/)
})
